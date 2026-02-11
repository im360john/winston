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

    // Step 2: Create service
    const serviceId = await createService(projectId, tenant);

    // Step 3: Create volume for configs
    const volumeId = await createVolume(projectId, serviceId);

    // Step 4: Upload config files to volume
    await uploadConfigs(projectId, serviceId, volumeId, configs);

    // Step 5: Set environment variables
    await setEnvironmentVariables(projectId, serviceId, tenant, configs);

    // Step 6: Deploy OpenClaw image
    const deployment = await deployImage(projectId, serviceId);

    // Step 5: Get public URL
    const url = await getServiceUrl(projectId, serviceId);

    console.log(`[Railway] Successfully provisioned tenant ${tenant.id}`);
    console.log(`[Railway] Service ID: ${serviceId}`);
    console.log(`[Railway] URL: ${url}`);

    return {
      projectId,
      serviceId,
      deploymentId: deployment.id,
      url
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
 * Create a new service in Railway
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
  return serviceId;
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
 * Set environment variables for the service
 */
async function setEnvironmentVariables(projectId, serviceId, tenant, configs) {
  const variables = {
    // OpenClaw required variables
    SETUP_PASSWORD: configs.gatewayToken.slice(0, 16), // Use part of gateway token as setup password
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

  // Get environment ID (use production environment)
  const envId = await getEnvironmentId(projectId);

  for (const [key, value] of Object.entries(variables)) {
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
    console.log(`[Railway] Set variable: ${key}`);
  }

  // TODO: Upload config files to Railway volume
  // For now, configs will be generated on container startup
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
 * Deploy the OpenClaw image
 */
async function deployImage(projectId, serviceId) {
  // Get environment ID
  const envId = await getEnvironmentId(projectId);

  const mutation = `
    mutation {
      serviceInstanceDeploy(
        serviceId: "${serviceId}",
        environmentId: "${envId}"
      )
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
 * Get public URL for the service
 */
async function getServiceUrl(projectId, serviceId) {
  // Railway will auto-generate a URL
  // For now, return placeholder - actual URL available in Railway dashboard

  const query = `
    query {
      service(id: "${serviceId}") {
        id
        name
      }
    }
  `;

  try {
    const response = await railwayRequest(query);
    const serviceName = response.data.service.name;
    // Railway auto-generates URLs like: project-name-production.up.railway.app
    return `https://${serviceName}-production.up.railway.app`;
  } catch (error) {
    console.log(`[Railway] Could not get service URL: ${error.message}`);
    return `https://railway.app/project/${projectId}`;
  }
}

/**
 * Make a GraphQL request to Railway API
 */
async function railwayRequest(query) {
  try {
    // Use environment variable to determine token type
    // Default to Bearer (Account/Workspace token) for broader access
    const useProjectToken = process.env.RAILWAY_USE_PROJECT_TOKEN === 'true';

    const headers = {
      'Content-Type': 'application/json'
    };

    if (useProjectToken) {
      headers['Project-Access-Token'] = RAILWAY_API_TOKEN;
    } else {
      headers['Authorization'] = `Bearer ${RAILWAY_API_TOKEN}`;
    }

    // Debug logging
    if (process.env.DEBUG_RAILWAY) {
      console.log('[Railway Debug] URL:', RAILWAY_API_URL);
      console.log('[Railway Debug] Headers:', headers);
      console.log('[Railway Debug] Query:', query.substring(0, 100));
    }

    const response = await axios.post(
      RAILWAY_API_URL,
      { query },
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
  railwayRequest
};
