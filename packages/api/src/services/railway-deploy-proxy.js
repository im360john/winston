/**
 * Deploy LLM Proxy to Railway
 * Creates a dedicated service for the Winston LLM Proxy
 */

const { railwayRequest } = require('./railway-provisioner');

async function deployProxyToRailway() {
  console.log('[Railway] Deploying LLM Proxy to Railway...\n');

  try {
    // Step 1: Get winston-poc project
    const projectId = await getProject();

    // Step 2: Create proxy service
    const serviceId = await createProxyService(projectId);

    // Step 3: Set environment variables
    await setProxyEnvironmentVariables(projectId, serviceId);

    // Step 4: Deploy the proxy
    await deployProxyImage(projectId, serviceId);

    // Step 5: Get the public URL
    const url = await getProxyUrl(projectId, serviceId);

    console.log('\n✅ LLM Proxy deployed to Railway!');
    console.log(`📡 Proxy URL: ${url}`);
    console.log(`\nUpdate your tenant services to use this URL:\n`);
    console.log(`LLM_PROXY_URL=${url}\n`);

    return { projectId, serviceId, url };

  } catch (error) {
    console.error('[Railway] Proxy deployment error:', error.message);
    throw error;
  }
}

async function getProject() {
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
  const project = projects.find(p => p.node.name === 'winston-poc');

  if (!project) {
    throw new Error('winston-poc project not found');
  }

  console.log(`[Railway] Using project: ${project.node.id}`);
  return project.node.id;
}

async function createProxyService(projectId) {
  console.log('[Railway] Creating proxy service from GitHub...');

  // Use GitHub repo: https://github.com/im360john/winston
  const mutation = `
    mutation {
      serviceCreate(input: {
        projectId: "${projectId}",
        name: "winston-llm-proxy",
        source: {
          repo: "im360john/winston",
          branch: "main"
        }
      }) {
        id
        name
      }
    }
  `;

  try {
    const response = await railwayRequest(mutation);
    const serviceId = response.data.serviceCreate.id;
    console.log(`[Railway] Created service: ${serviceId}`);
    return serviceId;
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('[Railway] Proxy service already exists, finding it...');
      return await findProxyService(projectId);
    }
    throw error;
  }
}

async function findProxyService(projectId) {
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

  const response = await railwayRequest(query);
  const services = response.data.project.services.edges;
  const proxyService = services.find(s => s.node.name === 'winston-llm-proxy');

  if (!proxyService) {
    throw new Error('Could not find winston-llm-proxy service');
  }

  console.log(`[Railway] Found existing service: ${proxyService.node.id}`);
  return proxyService.node.id;
}

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

async function setProxyEnvironmentVariables(projectId, serviceId) {
  console.log('[Railway] Setting proxy environment variables...');

  const envId = await getEnvironmentId(projectId);

  const variables = {
    // Railway-specific settings
    RAILWAY_SERVICE_ROOT: 'packages/proxy',
    RAILWAY_RUN_CMD: 'npm start',
    // Application settings
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: 'production',
    PORT: '3002'
  };

  for (const [key, value] of Object.entries(variables)) {
    if (!value && key !== 'NODE_ENV' && key !== 'PORT' && !key.startsWith('RAILWAY_')) {
      console.log(`⚠️  Warning: ${key} not set in local environment`);
      continue;
    }

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
    console.log(`  ✅ Set ${key}`);
  }
}

async function deployProxyImage(projectId, serviceId) {
  console.log('[Railway] Deploying proxy...');

  const envId = await getEnvironmentId(projectId);

  const mutation = `
    mutation {
      serviceInstanceDeploy(
        serviceId: "${serviceId}",
        environmentId: "${envId}"
      )
    }
  `;

  await railwayRequest(mutation);
  console.log('[Railway] Deployment triggered');
}

async function getProxyUrl(projectId, serviceId) {
  // Railway auto-generates URLs
  // For now, return the expected format
  return `https://winston-llm-proxy-production.up.railway.app`;
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../../.env') });

  deployProxyToRailway()
    .then(result => {
      console.log('\n✅ Deployment complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = { deployProxyToRailway };
