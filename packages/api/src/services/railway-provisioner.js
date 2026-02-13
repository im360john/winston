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
 * Save configs to file_snapshots table for sidecar access
 */
async function saveConfigsToFileSnapshots(tenantId, configs) {
  const { Pool } = require('pg');
  const crypto = require('crypto');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:vivWucvTWUMEpNLPwmYhFbvmlEeVOWCT@metro.proxy.rlwy.net:48303/railway'
  });

  try {
    for (const [filename, content] of Object.entries(configs)) {
      // Skip non-file configs
      if (['gatewayToken', 'openclawConfig', 'sidecarToken'].includes(filename)) {
        continue;
      }

      const hash = crypto.createHash('sha256').update(content).digest('hex');

      await pool.query(`
        INSERT INTO file_snapshots (tenant_id, file_path, content, hash, size, source)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        tenantId,
        filename,
        content,
        hash,
        Buffer.byteLength(content),
        'system'
      ]);
    }
    console.log('[Railway] Saved configs to file_snapshots table');
  } finally {
    await pool.end();
  }
}

/**
 * Provision tenant to Railway
 *
 * Creates a new Railway service with OpenClaw container
 *
 * @param {Object} tenant - Tenant record
 * @param {Object} configs - Generated config files
 * @param {Function} onProgress - Optional callback for incremental progress (serviceId, url)
 * @returns {Object} Provision result with serviceId and URL
 */
async function provisionToRailway(tenant, configs, onProgress = null) {
  if (!RAILWAY_API_TOKEN) {
    throw new Error('RAILWAY_API_TOKEN not configured');
  }

  console.log(`[Railway] Provisioning tenant ${tenant.id} to Railway...`);

  try {
    // Step 1: Create project (or use existing)
    const projectId = await getOrCreateProject();

    // Step 2: Get or create service (idempotent - handles partial failures)
    const serviceId = await getOrCreateService(projectId, tenant);

    // Save progress: service created
    if (onProgress) {
      await onProgress({ serviceId, step: 'service_created' });
    }

    // Step 2.5: Set root directory for monorepo builds
    await setRootDirectory(projectId, serviceId);

    // Step 3: Set ALL environment variables in single batch with skipDeploys=true
    // This adds variables without triggering new deployment
    await setEnvironmentVariables(projectId, serviceId, tenant, configs);

    // Step 4: Create volume for configs (if supported)
    const volumeId = await createVolume(projectId, serviceId);

    // Step 5: Upload config files to volume with skipDeploys=true
    // This adds config vars without triggering new deployment
    await uploadConfigs(projectId, serviceId, volumeId, configs);

    // Step 6: Now trigger ONE deployment with all variables set
    const deployment = await deployImage(projectId, serviceId);

    // Step 7: Wait for deployment to complete and get public URL
    const url = await getServiceUrl(projectId, serviceId);

    // Save progress: URL created
    if (onProgress) {
      await onProgress({ serviceId, url, step: 'url_created' });
    }

    // Step 8: Configure OpenClaw via setup API
    const setupPassword = configs.gatewayToken.slice(0, 16);
    try {
      await configureOpenClaw(url, setupPassword, configs.openclawConfig);
    } catch (error) {
      console.log('[Railway] OpenClaw auto-configuration failed, manual setup required');
      // Don't throw - service is still usable via manual setup
    }

    // Save configs to file_snapshots table
    try {
      await saveConfigsToFileSnapshots(tenant.id, configs);
    } catch (error) {
      console.log('[Railway] Warning: Could not save configs to file_snapshots:', error.message);
    }

    console.log(`[Railway] Successfully provisioned tenant ${tenant.id}`);
    console.log(`[Railway] Service ID: ${serviceId}`);
    console.log(`[Railway] URL: ${url}`);
    console.log(`[Railway] Setup URL: ${url}/setup (password: ${setupPassword})`);
    console.log(`[Railway] Sidecar API: ${url}:18790`);
    console.log(`[Railway] Sidecar Token: ${configs.sidecarToken?.substring(0, 20)}...`);

    return {
      projectId,
      serviceId,
      deploymentId: deployment.id,
      url,
      setupUrl: `${url}/setup`,
      setupPassword,
      sidecarUrl: `${url}:18790`,
      sidecarToken: configs.sidecarToken
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
 * Get existing service or create new one (idempotent)
 * Handles recovery from partial failures
 */
async function getOrCreateService(projectId, tenant) {
  const serviceName = `tenant-${tenant.id.slice(0, 8)}`;

  // First, check if service already exists
  console.log(`[Railway] Checking for existing service: ${serviceName}...`);

  const query = `
    query {
      project(id: "${projectId}") {
        services {
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

  try {
    const response = await railwayRequest(query);
    const services = response.data.project.services.edges;
    const existingService = services.find(s => s.node.name === serviceName);

    if (existingService) {
      console.log(`[Railway] Found existing service: ${existingService.node.id}`);
      console.log(`[Railway] Recovering from partial failure - reusing service`);
      return existingService.node.id;
    }
  } catch (error) {
    console.log(`[Railway] Error checking for existing service, will create new one`);
  }

  // Service doesn't exist, create it
  return await createService(projectId, tenant);
}

/**
 * Create service with GitHub source (Winston sidecar-enabled)
 * This triggers ONE initial deployment
 */
async function createService(projectId, tenant) {
  const serviceName = `tenant-${tenant.id.slice(0, 8)}`;

  const mutation = `
    mutation {
      serviceCreate(input: {
        projectId: "${projectId}",
        name: "${serviceName}",
        source: {
          repo: "im360john/winston"
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
  console.log(`[Railway] Deploying from: github.com/im360john/winston`);
  console.log(`[Railway] railway.json at repo root should configure build`);
  return serviceId;
}

/**
 * Set root directory for monorepo builds
 */
async function setRootDirectory(projectId, serviceId) {
  console.log('[Railway] Setting root directory for monorepo build...');

  // Get environment ID first
  const envId = await getEnvironmentId(projectId);

  const mutation = `
    mutation {
      serviceInstanceUpdate(
        input: {
          serviceId: "${serviceId}",
          environmentId: "${envId}",
          rootDirectory: "docker/openclaw-tenant"
        }
      )
    }
  `;

  try {
    await railwayRequest(mutation);
    console.log('[Railway] Root directory set to: docker/openclaw-tenant');
  } catch (error) {
    console.error('[Railway] Failed to set root directory:', error.message);
    throw error;
  }
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

  // Use variableCollectionUpsert to set all config variables at once with skipDeploys
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
      variables: configVars,
      skipDeploys: true  // CRITICAL: Prevents deployment on variable update
    }
  };

  await railwayRequest(mutation, variablesInput);

  console.log('[Railway] Config files encoded in environment variables (deployment skipped)');
  console.log('[Railway] Container will decode and write on startup');
}

/**
 * Set environment variables for the service using variableCollectionUpsert
 * This sets ALL variables in a single mutation with skipDeploys option
 */
async function setEnvironmentVariables(projectId, serviceId, tenant, configs) {
  // Generate sidecar token
  const crypto = require('crypto');
  const sidecarToken = crypto.randomBytes(32).toString('hex');

  // Store in configs for later use
  configs.sidecarToken = sidecarToken;

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
    WINSTON_TIER: tenant.tier,
    // Sidecar API
    WINSTON_SIDECAR_TOKEN: sidecarToken,
    NODE_ENV: 'production'
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

  // Use the correct mutation from Railway API cookbook
  const mutation = `
    mutation serviceInstanceDeploy($serviceId: String!, $environmentId: String!) {
      serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
    }
  `;

  const variables = {
    serviceId: serviceId,
    environmentId: envId
  };

  const response = await railwayRequest(mutation, variables);
  console.log(`[Railway] Deployment triggered via serviceInstanceDeploy`);

  return {
    id: 'deployment-triggered',
    status: 'deploying'
  };
}

/**
 * Create public domain for the service (idempotent)
 */
async function createPublicDomain(projectId, serviceId) {
  console.log('[Railway] Creating public domain...');

  const envId = await getEnvironmentId(projectId);

  // First check if domain already exists
  console.log('[Railway] Checking for existing domain...');
  const checkQuery = `
    query {
      service(id: "${serviceId}") {
        domains {
          serviceDomains {
            domain
          }
        }
      }
    }
  `;

  try {
    const checkResponse = await railwayRequest(checkQuery);
    const domains = checkResponse.data.service.domains?.serviceDomains || [];

    if (domains.length > 0) {
      const domain = domains[0].domain;
      console.log(`[Railway] Found existing domain: ${domain}`);
      return `https://${domain}`;
    }
  } catch (error) {
    console.log('[Railway] Error checking for domain, will try to create');
  }

  // No existing domain, create one
  const mutation = `
    mutation {
      serviceDomainCreate(input: {
        environmentId: "${envId}",
        serviceId: "${serviceId}"
      }) {
        id
        domain
      }
    }
  `;

  try {
    const response = await railwayRequest(mutation);
    const domain = response.data.serviceDomainCreate.domain;
    console.log(`[Railway] Public domain created: ${domain}`);
    return `https://${domain}`;
  } catch (error) {
    console.log('[Railway] Failed to create domain, retrying query...');

    // Creation might have failed but domain exists, check again
    const queryResponse = await railwayRequest(checkQuery);
    const domains = queryResponse.data.service.domains?.serviceDomains || [];

    if (domains.length > 0) {
      const domain = domains[0].domain;
      console.log(`[Railway] Using existing domain: ${domain}`);
      return `https://${domain}`;
    }

    throw new Error('Could not create or find public domain');
  }
}

/**
 * Get public URL for the service and wait for it to be ready
 */
async function getServiceUrl(projectId, serviceId) {
  console.log('[Railway] Getting service URL...');

  // Create public domain first
  const url = await createPublicDomain(projectId, serviceId);

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

  // First, wait for /setup page to be ready (200 or 401 are both good)
  console.log('[Railway] Waiting for OpenClaw setup page to be ready...');
  const maxSetupAttempts = 30; // 30 * 10s = 5 minutes
  const pollInterval = 10000; // 10 seconds
  let setupReady = false;

  for (let i = 0; i < maxSetupAttempts; i++) {
    try {
      const testResponse = await axios.get(`${url}/setup`, {
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      });

      // 200 = open setup, 401 = password protected setup (both are good!)
      if (testResponse.status === 200 || testResponse.status === 401) {
        console.log(`[Railway] Setup page is ready (status: ${testResponse.status})`);
        setupReady = true;
        break;
      } else {
        console.log(`[Railway] Setup page not ready yet (status: ${testResponse.status}), waiting...`);
      }
    } catch (err) {
      console.log(`[Railway] Waiting for setup page... attempt ${i + 1}/${maxSetupAttempts}`);
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  if (!setupReady) {
    throw new Error('Setup page never became ready after 5 minutes');
  }

  const puppeteer = require('puppeteer');
  let browser;

  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set HTTP Basic Auth credentials for 401 protected pages
    // OpenClaw uses empty username and setup password
    console.log('[Railway] Setting up authentication...');
    await page.authenticate({
      username: '',  // OpenClaw uses empty username
      password: setupPassword
    });

    // Navigate to setup page with auth
    console.log('[Railway] Navigating to setup page...');
    await page.goto(`${url}/setup`, { waitUntil: 'networkidle0', timeout: 30000 });

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
      console.log('[Railway] Looking for submit button...');
      let saveButton = await page.$('button[type="submit"]');

      if (!saveButton) {
        // Try finding by text content
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text && (text.includes('Save') || text.includes('Upload') || text.includes('Continue') || text.includes('Submit'))) {
            saveButton = button;
            break;
          }
        }
      }

      if (saveButton) {
        console.log('[Railway] Clicking submit button...');
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
        let uploadButton = await page.$('button[type="submit"]');
        if (!uploadButton) {
          const buttons = await page.$$('button');
          for (const button of buttons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text && (text.includes('Upload') || text.includes('Submit'))) {
              uploadButton = button;
              break;
            }
          }
        }

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
