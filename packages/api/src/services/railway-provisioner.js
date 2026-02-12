/**
 * Railway Provisioning Service
 *
 * Handles deployment of OpenClaw containers to Railway
 * Uses Railway GraphQL API for service creation and management
 */

const axios = require('axios');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN;
const RAILWAY_WORKSPACE_ID = process.env.RAILWAY_WORKSPACE_ID || '4a58ce21-7a1d-4a39-b095-dc7e75b1c2b3';

/**
 * Provision tenant to Railway
 *
 * Creates a new Railway service with OpenClaw container
 *
 * @param {Object} tenant - Tenant record
 * @param {Object} configs - Generated config files
 * @returns {Object} Provision result with serviceId and URL
 */
async function provisionToRailway(tenant, configs) {
  if (!RAILWAY_API_TOKEN) {
    throw new Error('RAILWAY_API_TOKEN not configured');
  }

  console.log(`[Railway] Provisioning tenant ${tenant.id} to Railway...`);

  try {
    // Step 1: Create project (or use existing)
    const projectId = await getOrCreateProject();

    // Step 2: Create service with GitHub source
    const serviceId = await createService(projectId, tenant);

    // Step 3: Set ALL environment variables in single batch with skipDeploys=true
    // This prevents deployment while we configure the service
    await setEnvironmentVariables(projectId, serviceId, tenant, configs);

    // Step 4: Create volume for configs (if supported)
    const volumeId = await createVolume(projectId, serviceId);

    // Step 5: Upload config files to volume
    await uploadConfigs(projectId, serviceId, volumeId, configs);

    // Step 6: Trigger deployment NOW that all variables are set
    const deployment = await deployImage(projectId, serviceId);

    // Step 7: Wait for deployment to complete and get public URL
    const url = await getServiceUrl(projectId, serviceId);

    // Step 8: Configure OpenClaw via setup API
    const setupPassword = configs.gatewayToken.slice(0, 16);
    try {
      await configureOpenClaw(url, setupPassword, configs.openclawConfig);
    } catch (error) {
      console.log('[Railway] OpenClaw auto-configuration failed, manual setup required');
      // Don't throw - service is still usable via manual setup
    }

    console.log(`[Railway] Successfully provisioned tenant ${tenant.id}`);
    console.log(`[Railway] Service ID: ${serviceId}`);
    console.log(`[Railway] URL: ${url}`);
    console.log(`[Railway] Setup URL: ${url}/setup (password: ${setupPassword})`);

    return {
      projectId,
      serviceId,
      deploymentId: deployment.id,
      url,
      setupUrl: `${url}/setup`,
      setupPassword
    };

  } catch (error) {
    console.error('[Railway] Provisioning error:', error.response?.data || error.message);
    throw new Error(`Railway provisioning failed: ${error.message}`);
  }
}

/**
 * Get existing Winston project or create new one
 */
async function getOrCreateProject() {
  // For POC, we'll use a single project for all tenants
  // In production, consider per-tenant projects for isolation

  const projectName = 'winston-poc';

  // Try to find existing project in workspace
  const query = `
    query {
      workspace(workspaceId: "${RAILWAY_WORKSPACE_ID}") {
        projects {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  `;

  const response = await railwayRequest(query);
  const projects = response.data.workspace.projects.edges;

  const existingProject = projects.find(p => p.node.name === projectName);

  if (existingProject) {
    console.log(`[Railway] Using existing project: ${existingProject.node.id}`);
    return existingProject.node.id;
  }

  // Create new project
  const createMutation = `
    mutation {
      projectCreate(input: {
        name: "${projectName}",
        description: "Winston POC - Multi-tenant OpenClaw platform",
        workspaceId: "${RAILWAY_WORKSPACE_ID}"
      }) {
        id
        name
      }
    }
  `;

  const createResponse = await railwayRequest(createMutation);
  const projectId = createResponse.data.projectCreate.id;

  console.log(`[Railway] Created new project: ${projectId}`);
  return projectId;
}

/**
 * Create service with source (will trigger deployments)
 * Railway doesn't support adding source after creation
 */
async function createService(projectId, tenant) {
  const serviceName = `tenant-${tenant.id.slice(0, 8)}`;

  const mutation = `
    mutation {
      serviceCreate(input: {
        projectId: "${projectId}",
        name: "${serviceName}",
        source: {
          repo: "vignesh07/clawdbot-railway-template"
        }
      }) {
        id
        name
      }
    }
  `;

  const response = await railwayRequest(mutation);
  const serviceId = response.data.serviceCreate.id;

  console.log(`[Railway] Created service: ${serviceId} (${serviceName})`);
  console.log(`[Railway] Note: Multiple deployments will trigger (Railway API limitation)`);
  return serviceId;
}

/**
 * Connect GitHub source to the service using serviceUpdate
 */
async function connectServiceSource(serviceId) {
  console.log('[Railway] Connecting GitHub source to service...');

  // Try using serviceUpdate instead of serviceConnect
  const mutation = `
    mutation {
      serviceUpdate(
        id: "${serviceId}",
        input: {
          source: {
            repo: "vignesh07/clawdbot-railway-template"
          }
        }
      ) {
        id
      }
    }
  `;

  try {
    await railwayRequest(mutation);
    console.log('[Railway] GitHub source connected via serviceUpdate');
  } catch (error) {
    console.error('[Railway] Failed to connect source:', error.message);
    throw error;
  }
}

/**
 * Create a volume for the service
 */
async function createVolume(projectId, serviceId) {
  const mutation = `
    mutation {
      volumeCreate(input: {
        projectId: "${projectId}",
        serviceId: "${serviceId}",
        name: "openclaw-data",
        mountPath: "/data"
      }) {
        id
        name
      }
    }
  `;

  try {
    const response = await railwayRequest(mutation);
    const volumeId = response.data.volumeCreate.id;
    console.log(`[Railway] Created volume: ${volumeId}`);
    return volumeId;
  } catch (error) {
    console.log(`[Railway] Volume creation failed (may already exist): ${error.message}`);
    return null; // Volume might already exist
  }
}

/**
 * Upload config files to Railway volume
 * Note: Railway doesn't have a direct file upload API
 * Workaround: Encode configs as environment variables and write them on startup
 */
async function uploadConfigs(projectId, serviceId, volumeId, configs) {
  console.log('[Railway] Encoding configs as environment variables...');

  // Encode each config file as base64 and set as env var
  const configVars = {
    WINSTON_OPENCLAW_JSON: Buffer.from(configs['openclaw.json']).toString('base64'),
    WINSTON_SOUL_MD: Buffer.from(configs['SOUL.md']).toString('base64'),
    WINSTON_AGENTS_MD: Buffer.from(configs['AGENTS.md']).toString('base64'),
    WINSTON_USER_MD: Buffer.from(configs['USER.md']).toString('base64'),
    WINSTON_IDENTITY_MD: Buffer.from(configs['IDENTITY.md']).toString('base64')
  };

  // Get environment ID
  const envId = await getEnvironmentId(projectId);

  // Set config environment variables
  for (const [key, value] of Object.entries(configVars)) {
    const mutation = `
      mutation {
        variableUpsert(input: {
          projectId: "${projectId}",
          environmentId: "${envId}",
          serviceId: "${serviceId}",
          name: "${key}",
          value: "${value}"
        })
      }
    `;

    await railwayRequest(mutation);
  }

  console.log('[Railway] Config files encoded in environment variables');
  console.log('[Railway] Container will decode and write on startup');
}

/**
 * Set environment variables for the service using variableCollectionUpsert
 * This sets ALL variables in a single mutation with skipDeploys option
 */
async function setEnvironmentVariables(projectId, serviceId, tenant, configs) {
  const variables = {
    // OpenClaw required variables
    SETUP_PASSWORD: configs.gatewayToken.slice(0, 16),
    PORT: '8080',
    OPENCLAW_GATEWAY_TOKEN: configs.gatewayToken,
    OPENCLAW_STATE_DIR: '/data/.openclaw',
    OPENCLAW_WORKSPACE_DIR: '/data/workspace',
    // LLM Proxy configuration
    LLM_PROXY_URL: process.env.LLM_PROXY_URL || 'https://winston-proxy.railway.app',
    // Tenant identification
    WINSTON_TENANT_ID: tenant.id,
    WINSTON_TIER: tenant.tier
  };

  // Get environment ID
  const envId = await getEnvironmentId(projectId);

  console.log('[Railway] Setting all environment variables in single batch...');

  // Use variableCollectionUpsert to set all variables at once with skipDeploys
  const mutation = `
    mutation variableCollectionUpsert($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }
  `;

  const variablesInput = {
    input: {
      projectId: projectId,
      environmentId: envId,
      serviceId: serviceId,
      variables: variables,
      skipDeploys: true  // CRITICAL: Prevents deployment on variable update
    }
  };

  await railwayRequest(mutation, variablesInput);
  console.log('[Railway] All environment variables set (deployment skipped)');
}

/**
 * Get production environment ID for a project
 */
async function getEnvironmentId(projectId) {
  const query = `
    query {
      project(id: "${projectId}") {
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  `;

  const response = await railwayRequest(query);
  const environments = response.data.project.environments.edges;

  // Find production environment or use first one
  const prodEnv = environments.find(e => e.node.name === 'production');
  const envId = prodEnv ? prodEnv.node.id : environments[0].node.id;

  console.log(`[Railway] Using environment: ${envId}`);
  return envId;
}

/**
 * Deploy the OpenClaw service
 */
async function deployImage(projectId, serviceId) {
  // Get environment ID
  const envId = await getEnvironmentId(projectId);

  const mutation = `
    mutation {
      environmentTriggersDeploy(input: {
        projectId: "${projectId}",
        environmentId: "${envId}",
        serviceId: "${serviceId}"
      })
    }
  `;

  const response = await railwayRequest(mutation);
  console.log(`[Railway] Deployment triggered`);

  return {
    id: 'deployment-triggered',
    status: 'deploying'
  };
}

/**
 * Get public URL for the service and wait for it to be ready
 */
async function getServiceUrl(projectId, serviceId) {
  console.log('[Railway] Getting service URL...');

  const query = `
    query {
      service(id: "${serviceId}") {
        id
        name
      }
    }
  `;

  const response = await railwayRequest(query);
  const serviceName = response.data.service.name;
  const url = `https://${serviceName}-production.up.railway.app`;

  console.log(`[Railway] Service URL: ${url}`);
  console.log('[Railway] Waiting for deployment to complete (2-3 minutes)...');

  // Wait minimum 2 minutes for Railway to build and deploy
  const minWaitTime = 120000; // 2 minutes
  console.log('[Railway] Initial wait: 120 seconds...');
  await new Promise(resolve => setTimeout(resolve, minWaitTime));

  // Then poll for service to be responding (max additional 3 minutes)
  const maxAttempts = 18; // 18 * 10s = 3 minutes
  const pollInterval = 10000; // 10 seconds

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const axios = require('axios');
      const testResponse = await axios.get(url, {
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500 // Accept any non-5xx response
      });

      // If we get any response (even 401/404), the service is running
      console.log(`[Railway] Service is responding (status: ${testResponse.status})`);
      console.log(`[Railway] Service is live at: ${url}`);
      return url;
    } catch (err) {
      console.log(`[Railway] Waiting for service... attempt ${i + 1}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  // After 5 minutes total, return URL anyway
  console.log(`[Railway] Timeout waiting for service, proceeding anyway...`);
  return url;
}

/**
 * Make a GraphQL request to Railway API
 */
async function railwayRequest(query, variables = null) {
  try {
    const useProjectToken = process.env.RAILWAY_USE_PROJECT_TOKEN === 'true';

    const headers = {
      'Content-Type': 'application/json'
    };

    if (useProjectToken) {
      headers['Project-Access-Token'] = RAILWAY_API_TOKEN;
    } else {
      headers['Authorization'] = `Bearer ${RAILWAY_API_TOKEN}`;
    }

    // Build request body
    const requestBody = { query };
    if (variables) {
      requestBody.variables = variables;
    }

    // Debug logging
    if (process.env.DEBUG_RAILWAY) {
      console.log('[Railway Debug] URL:', RAILWAY_API_URL);
      console.log('[Railway Debug] Headers:', headers);
      console.log('[Railway Debug] Query:', query.substring(0, 100));
      console.log('[Railway Debug] Variables:', JSON.stringify(variables));
    }

    const response = await axios.post(
      RAILWAY_API_URL,
      requestBody,
      { headers }
    );

    if (response.data.errors) {
      throw new Error(`Railway API error: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data;

  } catch (error) {
    if (error.response) {
      console.error('[Railway] API Error:', error.response.data);
      throw new Error(`Railway API request failed: ${error.response.statusText}`);
    }
    throw error;
  }
}

/**
 * Configure OpenClaw via setup wizard using Puppeteer
 */
async function configureOpenClaw(url, setupPassword, openclawConfig) {
  console.log('[Railway] Configuring OpenClaw via setup wizard...');

  const puppeteer = require('puppeteer');
  let browser;

  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Navigate to setup page
    console.log('[Railway] Navigating to setup page...');
    await page.goto(`${url}/setup`, { waitUntil: 'networkidle0', timeout: 30000 });

    // Check if password input exists
    const passwordInput = await page.$('input[type="password"]');
    if (!passwordInput) {
      throw new Error('Password input not found on setup page');
    }

    // Enter password
    console.log('[Railway] Entering setup password...');
    await page.type('input[type="password"]', setupPassword);

    // Submit password form
    const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Continue")');
    if (submitButton) {
      await Promise.all([
        submitButton.click(),
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {})
      ]);
    }

    // Wait a bit for the page to load
    await page.waitForTimeout(2000);

    // Look for config textarea or upload area
    console.log('[Railway] Looking for config editor...');
    const configTextarea = await page.$('textarea');

    if (configTextarea) {
      // Clear existing content and paste config
      console.log('[Railway] Uploading OpenClaw configuration...');
      await configTextarea.click({ clickCount: 3 }); // Select all
      await configTextarea.press('Backspace');
      await configTextarea.type(JSON.stringify(openclawConfig, null, 2), { delay: 10 });

      // Find and click save/submit button
      const saveButton = await page.$('button:has-text("Save"), button:has-text("Upload"), button:has-text("Continue"), button[type="submit"]');
      if (saveButton) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }

      console.log('[Railway] OpenClaw configuration uploaded successfully');
    } else {
      console.log('[Railway] Config textarea not found, checking for file upload...');

      // Look for file upload input
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        // Create temporary file with config
        const fs = require('fs');
        const tmpFile = '/tmp/openclaw-config.json';
        fs.writeFileSync(tmpFile, JSON.stringify(openclawConfig, null, 2));

        await fileInput.uploadFile(tmpFile);
        await page.waitForTimeout(1000);

        // Click upload button
        const uploadButton = await page.$('button:has-text("Upload"), button[type="submit"]');
        if (uploadButton) {
          await uploadButton.click();
          await page.waitForTimeout(2000);
        }

        console.log('[Railway] OpenClaw configuration uploaded via file');
      } else {
        throw new Error('No config input method found');
      }
    }

    return { success: true };

  } catch (error) {
    console.error('[Railway] Failed to configure OpenClaw:', error.message);
    console.log('[Railway] Manual configuration required at:', `${url}/setup`);
    console.log('[Railway] Setup password:', setupPassword);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Delete a Railway service (for cleanup)
 */
async function deleteService(serviceId) {
  const mutation = `
    mutation {
      serviceDelete(id: "${serviceId}")
    }
  `;

  await railwayRequest(mutation);
  console.log(`[Railway] Deleted service: ${serviceId}`);
}

module.exports = {
  provisionToRailway,
  deleteService,
  railwayRequest,
  configureOpenClaw
};
