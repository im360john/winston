/**
 * Railway Provisioning Service
 *
 * Handles deployment of OpenClaw containers to Railway
 * Uses Railway GraphQL API for service creation and management
 */

const axios = require('axios');

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN;

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

    // Step 3: Set environment variables
    await setEnvironmentVariables(projectId, serviceId, tenant, configs);

    // Step 4: Deploy OpenClaw image
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

  // Try to find existing project
  const query = `
    query {
      projects {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;

  const response = await railwayRequest(query);
  const projects = response.data.projects.edges;

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
        description: "Winston POC - Multi-tenant OpenClaw platform"
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
          image: "alpine/openclaw:latest"
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
 * Set environment variables for the service
 */
async function setEnvironmentVariables(projectId, serviceId, tenant, configs) {
  const variables = {
    OPENCLAW_GATEWAY_TOKEN: configs.gatewayToken,
    OPENCLAW_DATA_DIR: '/home/node/.openclaw',
    // LLM Proxy configuration
    LLM_PROXY_URL: process.env.LLM_PROXY_URL || 'https://winston-proxy.railway.app',
    // Tenant identification
    WINSTON_TENANT_ID: tenant.id,
    WINSTON_TIER: tenant.tier
  };

  for (const [key, value] of Object.entries(variables)) {
    const mutation = `
      mutation {
        variableUpsert(input: {
          projectId: "${projectId}",
          serviceId: "${serviceId}",
          name: "${key}",
          value: "${value}"
        }) {
          id
        }
      }
    `;

    await railwayRequest(mutation);
    console.log(`[Railway] Set variable: ${key}`);
  }

  // TODO: Upload config files to Railway volume
  // For now, configs will be generated on container startup
}

/**
 * Deploy the OpenClaw image
 */
async function deployImage(projectId, serviceId) {
  const mutation = `
    mutation {
      serviceInstanceDeploy(input: {
        serviceId: "${serviceId}",
        environmentId: "${projectId}"
      }) {
        id
        status
      }
    }
  `;

  const response = await railwayRequest(mutation);
  const deployment = response.data.serviceInstanceDeploy;

  console.log(`[Railway] Deployment started: ${deployment.id}`);
  return deployment;
}

/**
 * Get public URL for the service
 */
async function getServiceUrl(projectId, serviceId) {
  // Railway will auto-generate a URL
  // Format: service-name.up.railway.app

  const query = `
    query {
      service(id: "${serviceId}") {
        id
        name
        domains {
          id
          domain
        }
      }
    }
  `;

  const response = await railwayRequest(query);
  const service = response.data.service;

  if (service.domains && service.domains.length > 0) {
    return `https://${service.domains[0].domain}`;
  }

  // Generate expected URL
  const serviceName = service.name;
  return `https://${serviceName}.up.railway.app`;
}

/**
 * Make a GraphQL request to Railway API
 */
async function railwayRequest(query) {
  try {
    const response = await axios.post(
      RAILWAY_API_URL,
      { query },
      {
        headers: {
          'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
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
