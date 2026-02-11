/**
 * Database connection for LLM Proxy
 * Used for credit balance lookups and usage logging
 */

const { Pool } = require('pg');

let pool;

function getDb() {
  if (!pool) {
    // Use DATABASE_URL from environment (Railway) or fallback to localhost
    const config = process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        }
      : {
          host: 'localhost',
          database: 'winston',
          user: 'winston',
          password: 'winston',
          port: 5432,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        };

    pool = new Pool(config);

    pool.on('error', (err) => {
      console.error('[Proxy DB] Unexpected error on idle client', err);
    });
  }

  return pool;
}

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await getDb().query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn('[Proxy DB] Slow query:', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('[Proxy DB] Query error:', { text, error: error.message });
    throw error;
  }
}

module.exports = { getDb, query };
