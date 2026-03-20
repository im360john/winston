/**
 * Winston Schema Migration Runner
 */

import fs from 'fs';
import path from 'path';
import { getPool } from './client';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  const sql = getPool();
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT        PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export interface MigrationResult {
  version: string;
  status: 'applied' | 'skipped';
}

export async function runMigrations(): Promise<MigrationResult[]> {
  await ensureMigrationsTable();
  const sql = getPool();

  const applied = await sql<{ version: string }[]>`
    SELECT version FROM schema_migrations ORDER BY version
  `;
  const appliedSet = new Set(applied.map((r) => r.version));

  let files: string[] = [];
  if (fs.existsSync(MIGRATIONS_DIR)) {
    files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort();
  }

  const results: MigrationResult[] = [];

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (appliedSet.has(version)) {
      results.push({ version, status: 'skipped' });
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const ddl = fs.readFileSync(filePath, 'utf8');

    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any)`INSERT INTO schema_migrations (version) VALUES (${version})`;
    });

    results.push({ version, status: 'applied' });
  }

  return results;
}

export async function applyBaseSchema(): Promise<void> {
  const sql = getPool();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const ddl = fs.readFileSync(schemaPath, 'utf8');
  await sql.unsafe(ddl);
}
