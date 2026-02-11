/**
 * Winston Log Sync Worker
 *
 * Syncs tenant session logs from Railway containers to Postgres
 * Polls Railway for new log entries and writes to session_transcripts table
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Pool } = require('pg');
const axios = require('axios');

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN;
const SYNC_INTERVAL = 60000; // 60 seconds

const pool = new Pool({
  host: 'localhost',
  database: 'winston',
  user: 'winston',
  password: 'winston',
  port: 5432
});

/**
 * Main worker loop
 */
async function runWorker() {
  console.log('[Sync Worker] Starting log sync worker...');
  console.log(`[Sync Worker] Sync interval: ${SYNC_INTERVAL}ms`);

  while (true) {
    try {
      await syncAllTenants();
      await sleep(SYNC_INTERVAL);
    } catch (error) {
      console.error('[Sync Worker] Error in main loop:', error);
      await sleep(SYNC_INTERVAL);
    }
  }
}

/**
 * Sync logs for all active tenants
 */
async function syncAllTenants() {
  try {
    // Get all active tenant instances
    const result = await pool.query(`
      SELECT
        ti.id as instance_id,
        ti.tenant_id,
        ti.railway_service_id,
        t.name as tenant_name
      FROM tenant_instances ti
      JOIN tenants t ON ti.tenant_id = t.id
      WHERE ti.status = 'running'
        AND ti.railway_service_id IS NOT NULL
    `);

    if (result.rows.length === 0) {
      console.log('[Sync Worker] No active tenant instances to sync');
      return;
    }

    console.log(`[Sync Worker] Syncing logs for ${result.rows.length} tenants...`);

    for (const instance of result.rows) {
      try {
        await syncTenantLogs(instance);
      } catch (error) {
        console.error(`[Sync Worker] Error syncing tenant ${instance.tenant_id}:`, error.message);
      }
    }

    console.log('[Sync Worker] Sync cycle complete');

  } catch (error) {
    console.error('[Sync Worker] Error fetching tenants:', error);
  }
}

/**
 * Sync logs for a specific tenant
 */
async function syncTenantLogs(instance) {
  try {
    // Fetch logs from Railway
    const logs = await fetchRailwayLogs(instance.railway_service_id);

    if (!logs || logs.length === 0) {
      return;
    }

    // Parse and insert session logs
    let inserted = 0;
    for (const log of logs) {
      // Try to parse as JSONL session log
      try {
        const parsed = parseSessionLog(log);
        if (parsed) {
          await insertSessionLog(instance, parsed);
          inserted++;
        }
      } catch (parseError) {
        // Not a session log, skip
        continue;
      }
    }

    if (inserted > 0) {
      console.log(`[Sync Worker] Synced ${inserted} session logs for tenant ${instance.tenant_name}`);
    }

  } catch (error) {
    throw error;
  }
}

/**
 * Fetch logs from Railway via GraphQL API
 */
async function fetchRailwayLogs(serviceId) {
  if (!RAILWAY_API_TOKEN) {
    throw new Error('RAILWAY_API_TOKEN not configured');
  }

  try {
    const query = `
      query {
        deploymentLogs(
          serviceId: "${serviceId}",
          limit: 100
        ) {
          timestamp
          message
        }
      }
    `;

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

    return response.data.data.deploymentLogs || [];

  } catch (error) {
    throw new Error(`Failed to fetch Railway logs: ${error.message}`);
  }
}

/**
 * Parse session log from OpenClaw JSONL format
 */
function parseSessionLog(log) {
  try {
    // OpenClaw session logs are in JSONL format
    const data = JSON.parse(log.message);

    // Validate it's a session log
    if (!data.session_id || !data.role) {
      return null;
    }

    return {
      session_id: data.session_id,
      channel: data.channel || null,
      agent_id: data.agent_id || null,
      role: data.role,
      content: data.content || null,
      tool_calls: data.tool_calls || null,
      tokens_used: data.tokens_used || null,
      timestamp: new Date(log.timestamp)
    };

  } catch (error) {
    // Not valid JSON or not a session log
    return null;
  }
}

/**
 * Insert session log into database
 */
async function insertSessionLog(instance, log) {
  try {
    // Check if already exists (deduplication)
    const existing = await pool.query(`
      SELECT id FROM session_transcripts
      WHERE tenant_id = $1
        AND session_id = $2
        AND timestamp = $3
        AND role = $4
    `, [instance.tenant_id, log.session_id, log.timestamp, log.role]);

    if (existing.rows.length > 0) {
      // Already synced
      return;
    }

    // Insert new log
    await pool.query(`
      INSERT INTO session_transcripts (
        tenant_id, instance_id, session_id, channel,
        agent_id, role, content, tool_calls, tokens_used,
        timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      instance.tenant_id,
      instance.instance_id,
      log.session_id,
      log.channel,
      log.agent_id,
      log.role,
      log.content,
      log.tool_calls ? JSON.stringify(log.tool_calls) : null,
      log.tokens_used,
      log.timestamp
    ]);

  } catch (error) {
    // Ignore duplicate key errors
    if (error.code !== '23505') {
      throw error;
    }
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start worker
if (require.main === module) {
  runWorker().catch(error => {
    console.error('[Sync Worker] Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { syncAllTenants, syncTenantLogs };
