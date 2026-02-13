/**
 * Railway Provisioner with Sidecar Support
 *
 * Provisions tenants using the Winston sidecar-enabled container
 * This replaces the GitHub template approach with our custom Docker image
 */

const axios = require('axios');
const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');
const fs = require('fs').promises;

require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN;
const RAILWAY_PROJECT_ID = process.env.RAILWAY_PROJECT_ID;

/**
 * Provision tenant with sidecar-enabled container
 */
async function provisionTenantWithSidecar(tenant, configs, onProgress = null) {
  console.log(`[Sidecar] Provisioning tenant ${tenant.id}...`);

  try {
    // Step 1: Save configs to file_snapshots table
    console.log('[Sidecar] Saving configs to database...');
    await saveConfigsToDatabase(tenant.id, configs);

    // Step 2: Generate sidecar token
    const sidecarToken = crypto.randomBytes(32).toString('hex');
    console.log('[Sidecar] Generated sidecar API token');

    // Step 3: Create Railway service
    console.log('[Sidecar] Creating Railway service...');
    const serviceId = await createRailwayService(tenant);

    if (onProgress) {
      await onProgress({ step: 'service_created', serviceId });
    }

    // Step 4: Set environment variables
    console.log('[Sidecar] Setting environment variables...');
    await setEnvironmentVariables(serviceId, tenant, sidecarToken, configs);

    // Step 5: Create volume
    console.log('[Sidecar] Creating persistent volume...');
    await createVolume(RAILWAY_PROJECT_ID, serviceId);

    // Step 6: Deploy using Railway CLI
    console.log('[Sidecar] Deploying container via Railway CLI...');
    const deploymentUrl = await deployViaRailwayCLI(serviceId, tenant);

    // Step 7: Create public domain
    console.log('[Sidecar] Creating public domain...');
    const publicUrl = await createPublicDomain(RAILWAY_PROJECT_ID, serviceId);
    const sidecarUrl = `${publicUrl}:18790`;

    console.log('[Sidecar] ✅ Provisioning complete!');
    console.log(`[Sidecar] Service ID: ${serviceId}`);
    console.log(`[Sidecar] Public URL: ${publicUrl}`);
    console.log(`[Sidecar] Sidecar API: ${sidecarUrl}`);

    return {
      serviceId,
      publicUrl,
      sidecarUrl,
      sidecarToken,
      tenantId: tenant.id
    };

  } catch (error) {
    console.error('[Sidecar] Provisioning failed:', error.message);
    throw error;
  }
}

/**
 * Save configs to file_snapshots table
 */
async function saveConfigsToDatabase(tenantId, configs) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    for (const [filename, content] of Object.entries(configs)) {
      // Skip non-file configs
      if (filename === 'gatewayToken' || filename === 'openclawConfig') {
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

    console.log('[Sidecar] Saved configs to file_snapshots table');
  } finally {
    await pool.end();
  }
}

/**
 * Create Railway service
 */
async function createRailwayService(tenant) {
  const serviceName = `tenant-${tenant.id.slice(0, 8)}`;

  // First check if service already exists
  const query = `
    query {
      project(id: "${RAILWAY_PROJECT_ID}") {
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

  const response = await railwayRequest(query);
  const services = response.data.project.services.edges;
  const existing = services.find(s => s.node.name === serviceName);

  if (existing) {
    console.log(`[Sidecar] Using existing service: ${existing.node.id}`);
    return existing.node.id;
  }

  // Create new service (empty service, we'll deploy via CLI)
  const mutation = `
    mutation {
      serviceCreate(input: {
        projectId: "${RAILWAY_PROJECT_ID}",
        name: "${serviceName}"
      }) {
        id
        name
      }
    }
  `;

  const createResponse = await railwayRequest(mutation);
  const serviceId = createResponse.data.serviceCreate.id;

  console.log(`[Sidecar] Created service: ${serviceId}`);
  return serviceId;
}

/**
 * Set environment variables
 */
async function setEnvironmentVariables(serviceId, tenant, sidecarToken, configs) {
  const variables = {
    TENANT_ID: tenant.id,
    WINSTON_SIDECAR_TOKEN: sidecarToken,
    NODE_ENV: 'production',
    PORT: '8080',
    SETUP_PASSWORD: configs.gatewayToken?.slice(0, 16) || crypto.randomBytes(8).toString('hex'),
  };

  const envId = await getEnvironmentId(RAILWAY_PROJECT_ID);

  const mutation = `
    mutation variableCollectionUpsert($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }
  `;

  await railwayRequest(mutation, {
    input: {
      projectId: RAILWAY_PROJECT_ID,
      environmentId: envId,
      serviceId: serviceId,
      variables: variables,
      skipDeploys: true
    }
  });

  console.log('[Sidecar] Environment variables set');
}

/**
 * Create volume
 */
async function createVolume(projectId, serviceId) {
  const mutation = `
    mutation {
      volumeCreate(input: {
        projectId: "${projectId}",
        serviceId: "${serviceId}",
        name: "tenant-data",
        mountPath: "/data"
      }) {
        id
        name
      }
    }
  `;

  try {
    const response = await railwayRequest(mutation);
    console.log(`[Sidecar] Volume created: ${response.data.volumeCreate.id}`);
  } catch (error) {
    console.log(`[Sidecar] Volume may already exist: ${error.message}`);
  }
}

/**
 * Deploy via Railway CLI
 */
async function deployViaRailwayCLI(serviceId, tenant) {
  const dockerfilePath = path.join(__dirname, '../../../../docker/openclaw-tenant');

  console.log(`[Sidecar] Deploying from: ${dockerfilePath}`);

  try {
    // Link to the service and deploy
    const { stdout, stderr } = await execPromise(
      `cd ${dockerfilePath} && railway service ${serviceId} && railway up`,
      { timeout: 300000 } // 5 minute timeout
    );

    console.log('[Sidecar] Railway CLI output:', stdout);
    if (stderr) console.log('[Sidecar] Railway CLI stderr:', stderr);

    return stdout;
  } catch (error) {
    console.error('[Sidecar] Railway CLI deployment failed:', error.message);
    throw new Error(`Railway CLI deployment failed: ${error.message}`);
  }
}

/**
 * Create public domain
 */
async function createPublicDomain(projectId, serviceId) {
  const envId = await getEnvironmentId(projectId);

  // Check if domain exists
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
      return `https://${domains[0].domain}`;
    }
  } catch (error) {
    console.log('[Sidecar] No existing domain found');
  }

  // Create domain
  const mutation = `
    mutation {
      serviceDomainCreate(input: {
        environmentId: "${envId}",
        serviceId: "${serviceId}"
      }) {
        domain
      }
    }
  `;

  const response = await railwayRequest(mutation);
  const domain = response.data.serviceDomainCreate.domain;

  console.log(`[Sidecar] Domain created: ${domain}`);
  return `https://${domain}`;
}

/**
 * Get environment ID
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
  const prodEnv = environments.find(e => e.node.name === 'production');

  return prodEnv ? prodEnv.node.id : environments[0].node.id;
}

/**
 * Make Railway API request
 */
async function railwayRequest(query, variables = null) {
  const headers = {
    'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const requestBody = { query };
  if (variables) {
    requestBody.variables = variables;
  }

  const response = await axios.post(RAILWAY_API_URL, requestBody, { headers });

  if (response.data.errors) {
    throw new Error(`Railway API error: ${JSON.stringify(response.data.errors)}`);
  }

  return response.data;
}

module.exports = {
  provisionTenantWithSidecar,
  saveConfigsToDatabase
};
