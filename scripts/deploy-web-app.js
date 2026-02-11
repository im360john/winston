/**
 * Deploy Winston Web App to Railway
 */

const axios = require('axios');

const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN;
const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const PROJECT_ID = '15a7aa96-1d45-4724-9248-b7d09310acdb';
const ENVIRONMENT_ID = 'da8bd2ee-c31b-4e3c-98d0-9f4af7b9f654';

// GitHub repo details
const REPO_OWNER = 'im360john';
const REPO_NAME = 'winston';
const BRANCH = 'main';

async function makeRequest(query, variables = {}) {
  try {
    const response = await axios.post(
      RAILWAY_API_URL,
      { query, variables },
      {
        headers: {
          'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors, null, 2));
    }

    return response.data.data;
  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.data);
    }
    throw error;
  }
}

async function createWebService() {
  console.log('Creating winston-web service...');

  const mutation = `
    mutation ServiceCreate($input: ServiceCreateInput!) {
      serviceCreate(input: $input) {
        id
        name
      }
    }
  `;

  const variables = {
    input: {
      projectId: PROJECT_ID,
      name: 'winston-web',
      source: {
        repo: `${REPO_OWNER}/${REPO_NAME}`,
        branch: BRANCH,
      },
    },
  };

  const result = await makeRequest(mutation, variables);
  const serviceId = result.serviceCreate.id;

  console.log(`✅ Service created: ${serviceId}`);
  return serviceId;
}

async function connectServiceToEnvironment(serviceId) {
  console.log('Connecting service to environment...');

  const mutation = `
    mutation ServiceConnect($input: ServiceConnectInput!) {
      serviceConnect(input: $input)
    }
  `;

  const variables = {
    input: {
      serviceId,
      environmentId: ENVIRONMENT_ID,
    },
  };

  await makeRequest(mutation, variables);
  console.log('✅ Service connected to environment');
}

async function setEnvironmentVariables(serviceId) {
  console.log('Setting environment variables...');

  const variables = [
    {
      name: 'NEXT_PUBLIC_API_URL',
      value: 'https://winston-api-production.up.railway.app',
    },
    {
      name: 'NODE_ENV',
      value: 'production',
    },
    // Stripe keys will be added manually by user
    // {
    //   name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    //   value: 'pk_test_...',
    // },
    // {
    //   name: 'STRIPE_SECRET_KEY',
    //   value: 'sk_test_...',
    // },
  ];

  const mutation = `
    mutation VariableUpsert($input: VariableUpsertInput!) {
      variableUpsert(input: $input)
    }
  `;

  for (const variable of variables) {
    await makeRequest(mutation, {
      input: {
        projectId: PROJECT_ID,
        environmentId: ENVIRONMENT_ID,
        serviceId,
        name: variable.name,
        value: variable.value,
      },
    });
    console.log(`  ✓ Set ${variable.name}`);
  }

  console.log('✅ Environment variables configured');
  console.log('\n⚠️  MANUAL STEP REQUIRED:');
  console.log('   Add Stripe keys in Railway dashboard:');
  console.log('   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  console.log('   - STRIPE_SECRET_KEY');
}

async function setServiceSettings(serviceId) {
  console.log('Configuring service settings...');

  const mutation = `
    mutation ServiceInstanceUpdate($input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(input: $input)
    }
  `;

  const variables = {
    input: {
      environmentId: ENVIRONMENT_ID,
      serviceId,
      rootDirectory: '/packages/web',
      builder: 'NIXPACKS',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm start',
      healthcheckPath: '/',
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 3,
    },
  };

  await makeRequest(mutation, variables);
  console.log('✅ Service settings configured');
}

async function deployService(serviceId) {
  console.log('Triggering deployment...');

  const mutation = `
    mutation ServiceInstanceDeploy(
      $environmentId: String!
      $serviceId: String!
    ) {
      serviceInstanceDeploy(
        environmentId: $environmentId
        serviceId: $serviceId
      )
    }
  `;

  const variables = {
    environmentId: ENVIRONMENT_ID,
    serviceId,
  };

  await makeRequest(mutation, variables);
  console.log('✅ Deployment triggered');
}

async function getServiceUrl(serviceId) {
  console.log('Fetching service URL...');

  const query = `
    query Service($id: String!) {
      service(id: $id) {
        id
        name
        serviceInstances {
          edges {
            node {
              domains {
                serviceDomains {
                  domain
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await makeRequest(query, { id: serviceId });
  const domains = result.service.serviceInstances.edges[0]?.node?.domains?.serviceDomains;

  if (domains && domains.length > 0) {
    const url = `https://${domains[0].domain}`;
    console.log(`✅ Service URL: ${url}`);
    return url;
  }

  console.log('⚠️  URL not available yet - check Railway dashboard');
  return null;
}

async function main() {
  console.log('========================================');
  console.log('  Deploying Winston Web App to Railway');
  console.log('========================================\n');

  if (!RAILWAY_API_TOKEN) {
    console.error('❌ Error: RAILWAY_API_TOKEN environment variable not set');
    process.exit(1);
  }

  try {
    // Step 1: Create service
    const serviceId = await createWebService();

    // Step 2: Connect to environment
    await connectServiceToEnvironment(serviceId);

    // Step 3: Set environment variables
    await setEnvironmentVariables(serviceId);

    // Step 4: Configure service settings
    await setServiceSettings(serviceId);

    // Step 5: Deploy
    await deployService(serviceId);

    // Step 6: Get URL
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for domains to be created
    const url = await getServiceUrl(serviceId);

    console.log('\n========================================');
    console.log('✅ Winston Web App Deployed!');
    console.log('========================================\n');
    console.log('Service ID:', serviceId);
    if (url) {
      console.log('URL:', url);
    }
    console.log('\nNext steps:');
    console.log('1. Add Stripe keys in Railway dashboard');
    console.log('2. Wait for deployment to complete (~2-3 minutes)');
    console.log('3. Visit the URL to test the onboarding flow');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

main();
