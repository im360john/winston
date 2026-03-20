/**
 * Winston Database Client
 *
 * Wraps postgres.js with:
 * - Multi-tenant isolation via SET app.current_tenant_id before every query
 * - Connection pool (single shared pool per process)
 * - withTenant/queryTenant: scoped helpers that set the tenant context
 */

import postgres from 'postgres';
import type { SqlContext } from './types';

// ─── Connection ───────────────────────────────────────────────────────────────

let _pool: postgres.Sql | null = null;

export function getPool(): postgres.Sql {
  if (!_pool) {
    const url = process.env.WINSTON_DATABASE_URL;
    if (!url) {
      throw new Error('WINSTON_DATABASE_URL environment variable is required');
    }
    _pool = postgres(url, {
      max: 20,
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: () => {},   // suppress NOTICE messages in app logs
      types: {
        // Return numeric columns as numbers, not strings
        numeric: {
          to: 1700,
          from: [1700],
          serialize: (x: number) => String(x),
          parse: (x: string) => parseFloat(x),
        },
      },
    });
  }
  return _pool;
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

// ─── Tenant-scoped SQL ────────────────────────────────────────────────────────

/**
 * Returns a tenant-scoped transaction.
 * Every query run inside the callback automatically targets tenantId via RLS.
 *
 * Usage:
 *   const rows = await withTenant(tenantId, async (sql) => {
 *     return sql`SELECT * FROM products WHERE category = 'flower'`;
 *   });
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (sql: SqlContext) => Promise<T>
): Promise<T> {
  const pool = getPool();
  return pool.begin(async (tx) => {
    // SET LOCAL scopes the variable to this transaction block
    await (tx as unknown as SqlContext)`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return fn(tx as unknown as SqlContext);
  }) as Promise<T>;
}

/**
 * Run a read-only query scoped to tenantId.
 * Uses the same transaction mechanism as withTenant.
 */
export async function queryTenant<T>(
  tenantId: string,
  fn: (sql: SqlContext) => Promise<T>
): Promise<T> {
  return withTenant(tenantId, fn);
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const sql = getPool();
    await sql`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
