/**
 * Simple Railway Deployment
 * Creates placeholder services that can be configured in the dashboard
 */

const { railwayRequest } = require('./railway-provisioner');
const path = require('path');

const PROJECT_ID = '15a7aa96-1d45-4724-9248-b7d09310acdb';
const ENV_ID = '5cf26fdc-2170-4e7b-80e3-6390bf1a9bcc';

async function deployProxyService() {
  console.log('🚀 Creating winston-proxy service...\n');

  try {
    // Create service with Node image
    const mutation = `
      mutation {
        serviceCreate(input: {
          projectId: "${PROJECT_ID}",
          name: "winston-proxy",
          source: {
            image: "node:20-alpine"
          }
        }) {
          id
          name
        }
      }
    `;

    const response = await railwayRequest(mutation);
    const serviceId = response.data.serviceCreate.id;

    console.log(`✅ Created service: ${serviceId}`);
    console.log(`\n📝 Next steps in Railway dashboard:`);
    console.log(`1. Go to winston-proxy service settings`);
    console.log(`2. Connect to GitHub repo: im360john/winston`);
    console.log(`3. Set root directory: packages/proxy`);
    console.log(`4. Set environment variables:`);
    console.log(`   - ANTHROPIC_API_KEY`);
    console.log(`   - MOONSHOT_API_KEY`);
    console.log(`   - DATABASE_URL (link to Postgres plugin)`);
    console.log(`   - PORT=3002`);
    console.log(`5. Deploy`);
    console.log(`\n🔗 https://railway.app/project/${PROJECT_ID}/service/${serviceId}`);

    return serviceId;

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Service already exists');
      console.log('\n🔗 Check Railway dashboard to configure it');
      return null;
    }
    throw error;
  }
}

async function deployAPIService() {
  console.log('\n🚀 Creating winston-api service...\n');

  try {
    const mutation = `
      mutation {
        serviceCreate(input: {
          projectId: "${PROJECT_ID}",
          name: "winston-api",
          source: {
            image: "node:20-alpine"
          }
        }) {
          id
          name
        }
      }
    `;

    const response = await railwayRequest(mutation);
    const serviceId = response.data.serviceCreate.id;

    console.log(`✅ Created service: ${serviceId}`);
    console.log(`\n📝 Next steps in Railway dashboard:`);
    console.log(`1. Go to winston-api service settings`);
    console.log(`2. Connect to GitHub repo: im360john/winston`);
    console.log(`3. Set root directory: packages/api`);
    console.log(`4. Set environment variables:`);
    console.log(`   - DATABASE_URL (link to Postgres plugin)`);
    console.log(`   - LLM_PROXY_URL (use winston-proxy internal URL)`);
    console.log(`   - RAILWAY_API_TOKEN`);
    console.log(`   - PORT=3001`);
    console.log(`5. Deploy`);
    console.log(`\n🔗 https://railway.app/project/${PROJECT_ID}/service/${serviceId}`);

    return serviceId;

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Service already exists');
      console.log('\n🔗 Check Railway dashboard to configure it');
      return null;
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

  (async () => {
    console.log('=' .repeat(60));
    console.log('   Winston Railway Deployment');
    console.log('=' .repeat(60));
    console.log();

    try {
      await deployProxyService();
      await deployAPIService();

      console.log('\n' + '='.repeat(60));
      console.log('✅ Services created!');
      console.log('='.repeat(60));
      console.log('\n💡 Complete configuration in Railway dashboard:');
      console.log(`   https://railway.app/project/${PROJECT_ID}`);
      console.log();
      console.log('📚 Don\'t forget to:');
      console.log('   1. Add PostgreSQL plugin if not already added');
      console.log('   2. Link database to both services');
      console.log('   3. Set up GitHub integration for each service');
      console.log('   4. Configure environment variables');
      console.log('   5. Deploy both services');
      console.log();

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { deployProxyService, deployAPIService };
