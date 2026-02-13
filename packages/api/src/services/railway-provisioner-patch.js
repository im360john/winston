/**
 * PATCH: Add Sidecar Support to Existing Railway Provisioner
 *
 * Apply these changes to railway-provisioner.js:
 * 1. Add WINSTON_SIDECAR_TOKEN to environment variables
 * 2. Add file_snapshots save function
 * 3. Return sidecar URL and token
 */

const crypto = require('crypto');

// ADD THIS to the setEnvironmentVariables function (line 335)
// Insert after line 346 (WINSTON_TIER: tenant.tier)
const PATCH_ENV_VARS = {
  // Add sidecar token
  WINSTON_SIDECAR_TOKEN: crypto.randomBytes(32).toString('hex')
};

// ADD THIS new function before provisionToRailway
async function saveConfigsToFileSnapshots(tenantId, configs) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:vivWucvTWUMEpNLPwmYhFbvmlEeVOWCT@metro.proxy.rlwy.net:48303/railway'
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
        ON CONFLICT (tenant_id, file_path) DO UPDATE
        SET content = $3, hash = $4, size = $5, captured_at = NOW()
      `, [
        tenantId,
        filename,
        content,
        hash,
        Buffer.byteLength(content),
        'system'
      ]);
    }
    console.log('[Railway] Saved configs to file_snapshots');
  } finally {
    await pool.end();
  }
}

// MODIFY provisionToRailway to:
// 1. Call saveConfigsToFileSnapshots after generating configs
// 2. Store sidecarToken from env vars
// 3. Return sidecarUrl in result

module.exports = {
  PATCH_ENV_VARS,
  saveConfigsToFileSnapshots
};
