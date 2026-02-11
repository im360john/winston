/**
 * Simplified Railway deployment for winston-web
 */

const axios = require('axios');

const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN;
const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const PROJECT_ID = '15a7aa96-1d45-4724-9248-b7d09310acdb';
const ENVIRONMENT_ID = 'da8bd2ee-c31b-4e3c-98d0-9f4af7b9f654';

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

async function createEmptyService() {
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
    },
  };

  const result = await makeRequest(mutation, variables);
  const serviceId = result.serviceCreate.id;

  console.log(`✅ Service created: ${serviceId}`);
  return serviceId;
}

async function connectToGitHub(serviceId) {
  console.log('Connecting to GitHub...');

  const mutation = `
    mutation ServiceConnect($input: ServiceConnectInput!) {
      serviceConnect(input: $input)
    }
  `;

  const variables = {
    input: {
      branch: 'main',
      repo: 'im360john/winston',
      serviceId,
    },
  };

  await makeRequest(mutation, variables);
  console.log('✅ Connected to GitHub repo');
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
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm start',
    },
  };

  await makeRequest(mutation, variables);
  console.log('✅ Service settings configured');
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
    const serviceId = await createEmptyService();
    await connectToGitHub(serviceId);
    await setEnvironmentVariables(serviceId);
    await setServiceSettings(serviceId);

    console.log('\n========================================');
    console.log('✅ Winston Web App Service Created!');
    console.log('========================================\n');
    console.log('Service ID:', serviceId);
    console.log('\nNext steps:');
    console.log('1. Go to Railway dashboard');
    console.log('2. Add Stripe keys:');
    console.log('   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
    console.log('   - STRIPE_SECRET_KEY');
    console.log('3. Click "Deploy" to trigger first deployment');
    console.log('4. Wait for build to complete (~2-3 minutes)');
    console.log('\nProject URL: https://railway.app/project/15a7aa96-1d45-4724-9248-b7d09310acdb');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

main();
