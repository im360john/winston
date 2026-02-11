/**
 * Railway Cleanup Utility
 * Delete test services and projects
 */

const { railwayRequest, deleteService } = require('./railway-provisioner');

async function listProjects() {
  const query = `
    query {
      projects {
        edges {
          node {
            id
            name
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
      }
    }
  `;

  const response = await railwayRequest(query);
  return response.data.projects.edges;
}

async function deleteAllTestServices() {
  console.log('[Cleanup] Finding winston-poc project...');
  const projects = await listProjects();

  const winstonProject = projects.find(p => p.node.name === 'winston-poc');

  if (!winstonProject) {
    console.log('[Cleanup] No winston-poc project found');
    return;
  }

  console.log(`[Cleanup] Found project: ${winstonProject.node.id}`);

  const services = winstonProject.node.services.edges;
  console.log(`[Cleanup] Found ${services.length} services`);

  for (const service of services) {
    console.log(`[Cleanup] Deleting service: ${service.node.name} (${service.node.id})`);
    try {
      await deleteService(service.node.id);
      console.log(`[Cleanup] ✅ Deleted ${service.node.name}`);
    } catch (error) {
      console.error(`[Cleanup] ❌ Failed to delete ${service.node.name}:`, error.message);
    }
  }

  console.log('[Cleanup] Cleanup complete!');
}

// Run if called directly
if (require.main === module) {
  deleteAllTestServices().catch(error => {
    console.error('[Cleanup] Error:', error);
    process.exit(1);
  });
}

module.exports = { deleteAllTestServices, listProjects };
