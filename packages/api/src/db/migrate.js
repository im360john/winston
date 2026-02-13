/**
 * Simple migration runner for Winston.
 *
 * - Applies `schema.sql` (idempotent) and then any `migrations/*.sql` files.
 * - Tracks applied files in `schema_migrations`.
 *
 * Usage:
 *   DATABASE_URL=... node packages/api/src/db/migrate.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load repo-root .env if present (local dev convenience).
try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });
} catch (_) {
  // Optional.
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

function readSql(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function hasMigration(client, name) {
  const res = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
  return res.rowCount > 0;
}

async function recordMigration(client, name) {
  await client.query(
    'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
    [name]
  );
}

async function applySqlFile(client, name, filePath) {
  const sql = readSql(filePath);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await recordMigration(client, name);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (!(await hasMigration(client, 'schema.sql'))) {
      // eslint-disable-next-line no-console
      console.log(`[db:migrate] Applying schema.sql`);
      await applySqlFile(client, 'schema.sql', schemaPath);
    } else {
      // eslint-disable-next-line no-console
      console.log('[db:migrate] schema.sql already applied (tracked), skipping');
    }

    const migrationsDir = path.resolve(__dirname, 'migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      if (await hasMigration(client, file)) {
        // eslint-disable-next-line no-console
        console.log(`[db:migrate] ${file} already applied, skipping`);
        continue;
      }
      // eslint-disable-next-line no-console
      console.log(`[db:migrate] Applying ${file}`);
      await applySqlFile(client, file, path.join(migrationsDir, file));
    }

    // eslint-disable-next-line no-console
    console.log('[db:migrate] Done');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[db:migrate] Failed:', err);
  process.exit(1);
});

