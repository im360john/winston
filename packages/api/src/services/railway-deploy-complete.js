/**
 * Complete Railway Deployment
 * Deploys the full Winston stack to Railway:
 * 1. PostgreSQL database
 * 2. LLM Proxy service
 * 3. Winston API service
 */

const { railwayRequest } = require('./railway-provisioner');
const fs = require('fs').promises;
const path = require('path');

async function deployCompleteStack() {
  console.log('🚀 Deploying Winston to Railway\n');

  try {
    // Step 1: Get or create project
    const projectId = await getProject();
    const envId = await getEnvironmentId(projectId);

    // Step 2: Create PostgreSQL database
    const databaseUrl = await createDatabase(projectId, envId);

    // Step 3: Deploy LLM Proxy
    const proxyUrl = await deployProxy(projectId, envId, databaseUrl);

    // Step 4: Deploy Winston API
    await deployAPI(projectId, envId, databaseUrl, proxyUrl);

    console.log('\n✅ Winston fully deployed to Railway!');
    console.log(`\n📊 Database: Railway PostgreSQL`);
    console.log(`📡 Proxy: ${proxyUrl}`);
    console.log(`🌐 API: Check Railway dashboard`);
    console.log(`\n🔗 Dashboard: https://railway.app/project/${projectId}`);

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
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

  if (project) {
    console.log(`📦 Using existing project: ${project.node.id}\n`);
    return project.node.id;
  }

  // Create new project
  console.log('📦 Creating winston-poc project...');
  const createMutation = `
    mutation {
      projectCreate(input: {
        name: "winston-poc",
        description: "Winston POC - Multi-tenant AI platform"
      }) {
        id
        name
      }
    }
  `;

  const createResponse = await railwayRequest(createMutation);
  const projectId = createResponse.data.projectCreate.id;
  console.log(`✅ Created project: ${projectId}\n`);
  return projectId;
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

async function createDatabase(projectId, envId) {
  console.log('🗄️  Creating PostgreSQL database...');

  // Check if database already exists
  const servicesQuery = `
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

  const servicesResponse = await railwayRequest(servicesQuery);
  const services = servicesResponse.data.project.services.edges;
  const dbService = services.find(s => s.node.name === 'postgres' || s.node.name.includes('postgresql'));

  if (dbService) {
    console.log('✅ Database already exists\n');
    // Get connection string from environment variables
    return 'RAILWAY_PROVIDED_DATABASE_URL'; // Railway will provide this
  }

  const mutation = `
    mutation {
      databaseCreate(input: {
        projectId: "${projectId}",
        environmentId: "${envId}",
        type: POSTGRESQL
      }) {
        id
      }
    }
  `;

  try {
    const response = await railwayRequest(mutation);
    console.log('✅ PostgreSQL database created\n');
    return 'RAILWAY_PROVIDED_DATABASE_URL'; // Railway automatically provides this variable
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Database already exists\n');
      return 'RAILWAY_PROVIDED_DATABASE_URL';
    }
    throw error;
  }
}

async function deployProxy(projectId, envId, databaseUrl) {
  console.log('📡 Deploying LLM Proxy...');

  // Create or find proxy service
  const serviceId = await createService(projectId, 'winston-proxy', 'im360john/winston', 'main');

  // Set environment variables
  await setVariable(projectId, envId, serviceId, 'RAILWAY_SERVICE_ROOT', 'packages/proxy');
  await setVariable(projectId, envId, serviceId, 'RAILWAY_RUN_CMD', 'npm install && npm start');
  await setVariable(projectId, envId, serviceId, 'ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY);
  await setVariable(projectId, envId, serviceId, 'MOONSHOT_API_KEY', process.env.MOONSHOT_API_KEY);
  await setVariable(projectId, envId, serviceId, 'DATABASE_URL', '${{Postgres.DATABASE_URL}}');
  await setVariable(projectId, envId, serviceId, 'NODE_ENV', 'production');
  await setVariable(projectId, envId, serviceId, 'PORT', '3002');

  // Deploy
  await deployService(serviceId, envId);

  console.log('✅ LLM Proxy deployed\n');
  return `https://winston-proxy-production.up.railway.app`;
}

async function deployAPI(projectId, envId, databaseUrl, proxyUrl) {
  console.log('🌐 Deploying Winston API...');

  const serviceId = await createService(projectId, 'winston-api', 'im360john/winston', 'main');

  await setVariable(projectId, envId, serviceId, 'RAILWAY_SERVICE_ROOT', 'packages/api');
  await setVariable(projectId, envId, serviceId, 'RAILWAY_RUN_CMD', 'npm install && npm start');
  await setVariable(projectId, envId, serviceId, 'DATABASE_URL', '${{Postgres.DATABASE_URL}}');
  await setVariable(projectId, envId, serviceId, 'LLM_PROXY_URL', proxyUrl);
  await setVariable(projectId, envId, serviceId, 'RAILWAY_API_TOKEN', process.env.RAILWAY_API_TOKEN);
  await setVariable(projectId, envId, serviceId, 'NODE_ENV', 'production');
  await setVariable(projectId, envId, serviceId, 'PORT', '3001');

  await deployService(serviceId, envId);

  console.log('✅ Winston API deployed\n');
}

async function createService(projectId, name, repo, branch) {
  const mutation = `
    mutation {
      serviceCreate(input: {
        projectId: "${projectId}",
        name: "${name}",
        source: {
          repo: "${repo}",
          branch: "${branch}"
        }
      }) {
        id
        name
      }
    }
  `;

  try {
    const response = await railwayRequest(mutation);
    return response.data.serviceCreate.id;
  } catch (error) {
    if (error.message.includes('already exists')) {
      return await findService(projectId, name);
    }
    throw error;
  }
}

async function findService(projectId, name) {
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
  const service = services.find(s => s.node.name === name);

  if (!service) {
    throw new Error(`Service ${name} not found`);
  }

  return service.node.id;
}

async function setVariable(projectId, envId, serviceId, name, value) {
  const mutation = `
    mutation {
      variableUpsert(input: {
        projectId: "${projectId}",
        environmentId: "${envId}",
        serviceId: "${serviceId}",
        name: "${name}",
        value: "${value}"
      })
    }
  `;

  await railwayRequest(mutation);
}

async function deployService(serviceId, envId) {
  const mutation = `
    mutation {
      serviceInstanceDeploy(
        serviceId: "${serviceId}",
        environmentId: "${envId}"
      )
    }
  `;

  await railwayRequest(mutation);
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

  deployCompleteStack()
    .then(() => {
      console.log('\n🎉 Deployment complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Error:', error);
      process.exit(1);
    });
}

module.exports = { deployCompleteStack };
