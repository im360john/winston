/**
 * Railway Reset & Redeploy
 * Deletes all test services and creates fresh ones with GitHub integration
 */

const { railwayRequest, deleteService } = require('./railway-provisioner');
const path = require('path');

const PROJECT_ID = '15a7aa96-1d45-4724-9248-b7d09310acdb';
const ENV_ID = '5cf26fdc-2170-4e7b-80e3-6390bf1a9bcc';

// Known service IDs to delete
const SERVICES_TO_DELETE = [
  { id: '10fc0864-558f-4a27-9bdd-c82ec7909d04', name: 'tenant-2a3ae611' },
  { id: '4ff6fe91-b5fe-4d5e-a92e-96bc59bef5ce', name: 'winston-proxy' },
  { id: '8d914bb7-4fa4-4cf3-80e6-55c2be1cfe3f', name: 'winston-api' }
];

async function deleteAllServices() {
  console.log('🧹 Cleaning up test services...\n');

  for (const service of SERVICES_TO_DELETE) {
    try {
      console.log(`Deleting ${service.name} (${service.id})...`);
      await deleteService(service.id);
      console.log(`✅ Deleted ${service.name}`);
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('Not Found')) {
        console.log(`⚠️  ${service.name} not found (already deleted)`);
      } else {
        console.error(`❌ Failed to delete ${service.name}:`, error.message);
      }
    }
  }

  console.log('\n✅ Cleanup complete\n');
}

async function createProxyWithGitHub() {
  console.log('📡 Creating winston-proxy with GitHub integration...\n');

  // Note: Railway's GraphQL API doesn't support GitHub source in serviceCreate
  // We need to create with image first, then user connects GitHub in dashboard
  // OR use Railway CLI

  const mutation = `
    mutation {
      serviceCreate(input: {
        projectId: "${PROJECT_ID}",
        name: "winston-llm-proxy"
      }) {
        id
        name
      }
    }
  `;

  try {
    const response = await railwayRequest(mutation);
    const serviceId = response.data.serviceCreate.id;

    console.log(`✅ Created winston-llm-proxy: ${serviceId}`);
    console.log(`\n📝 Configure in Railway dashboard:`);
    console.log(`   https://railway.app/project/${PROJECT_ID}/service/${serviceId}`);
    console.log(`\n   1. Click "Settings"`);
    console.log(`   2. Under "Source", click "Connect Repo"`);
    console.log(`   3. Select: im360john/winston`);
    console.log(`   4. Branch: main`);
    console.log(`   5. Root Directory: packages/proxy`);
    console.log(`   6. Set environment variables (see below)`);
    console.log(`   7. Click "Deploy"`);

    return serviceId;
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  Service already exists');
    } else {
      throw error;
    }
  }
}

async function createAPIWithGitHub() {
  console.log('\n🌐 Creating winston-api with GitHub integration...\n');

  const mutation = `
    mutation {
      serviceCreate(input: {
        projectId: "${PROJECT_ID}",
        name: "winston-api"
      }) {
        id
        name
      }
    }
  `;

  try {
    const response = await railwayRequest(mutation);
    const serviceId = response.data.serviceCreate.id;

    console.log(`✅ Created winston-api: ${serviceId}`);
    console.log(`\n📝 Configure in Railway dashboard:`);
    console.log(`   https://railway.app/project/${PROJECT_ID}/service/${serviceId}`);
    console.log(`\n   1. Click "Settings"`);
    console.log(`   2. Under "Source", click "Connect Repo"`);
    console.log(`   3. Select: im360john/winston`);
    console.log(`   4. Branch: main`);
    console.log(`   5. Root Directory: packages/api`);
    console.log(`   6. Set environment variables (see below)`);
    console.log(`   7. Click "Deploy"`);

    return serviceId;
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  Service already exists');
    } else {
      throw error;
    }
  }
}

function printEnvVars() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 Environment Variables to Set');
  console.log('='.repeat(60));

  console.log('\n🔹 winston-llm-proxy:');
  console.log('   ANTHROPIC_API_KEY=<your-key>');
  console.log('   MOONSHOT_API_KEY=<your-key>');
  console.log('   DATABASE_URL=${{Postgres.DATABASE_URL}}');
  console.log('   NODE_ENV=production');
  console.log('   PORT=3002');

  console.log('\n🔹 winston-api:');
  console.log('   DATABASE_URL=${{Postgres.DATABASE_URL}}');
  console.log('   LLM_PROXY_URL=${{winston-llm-proxy.RAILWAY_PUBLIC_DOMAIN}}');
  console.log('   RAILWAY_API_TOKEN=<your-railway-token>');
  console.log('   ANTHROPIC_API_KEY=<your-key>');
  console.log('   MOONSHOT_API_KEY=<your-key>');
  console.log('   NODE_ENV=production');
  console.log('   PORT=3001');

  console.log('\n' + '='.repeat(60));
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

  (async () => {
    console.log('=' .repeat(60));
    console.log('   Winston Railway Reset & Redeploy');
    console.log('=' .repeat(60));
    console.log();

    try {
      // Step 1: Delete all test services
      await deleteAllServices();

      // Step 2: Create new services
      await createProxyWithGitHub();
      await createAPIWithGitHub();

      // Step 3: Print configuration instructions
      printEnvVars();

      console.log('\n✅ Services reset complete!');
      console.log(`\n🔗 Dashboard: https://railway.app/project/${PROJECT_ID}`);
      console.log();

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { deleteAllServices, createProxyWithGitHub, createAPIWithGitHub };
