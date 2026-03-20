/**
 * Sync jobs repository — tracks ingestion pipeline state per tenant + source.
 */

import type { SqlContext } from '../../db/types';

export type SyncStatus = 'pending' | 'running' | 'success' | 'failed';

export interface SyncJobRow {
  id: string;
  tenantId: string;
  source: string;
  entityType: string;
  status: SyncStatus;
  recordsSynced: number;
  lastSyncedAt: Date | null;
  cursor: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  updatedAt: Date;
}

function mapRow(row: Record<string, unknown>): SyncJobRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    source: row.source as string,
    entityType: row.entity_type as string,
    status: row.status as SyncStatus,
    recordsSynced: row.records_synced as number,
    lastSyncedAt: row.last_synced_at as Date | null,
    cursor: row.cursor as string | null,
    errorMessage: row.error_message as string | null,
    startedAt: row.started_at as Date | null,
    finishedAt: row.finished_at as Date | null,
    updatedAt: row.updated_at as Date,
  };
}

export async function getSyncJob(
  sql: SqlContext,
  source: string,
  entityType: string
): Promise<SyncJobRow | null> {
  const rows = await sql`
    SELECT * FROM sync_jobs WHERE source = ${source} AND entity_type = ${entityType}
  `;
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function markSyncStarted(
  sql: SqlContext,
  tenantId: string,
  source: string,
  entityType: string
): Promise<SyncJobRow> {
  const [row] = await sql`
    INSERT INTO sync_jobs (tenant_id, source, entity_type, status, started_at)
    VALUES (${tenantId}, ${source}, ${entityType}, 'running', NOW())
    ON CONFLICT (tenant_id, source, entity_type) DO UPDATE SET
      status      = 'running',
      started_at  = NOW(),
      finished_at = NULL,
      error_message = NULL
    RETURNING *
  `;
  return mapRow(row);
}

export async function markSyncSuccess(
  sql: SqlContext,
  tenantId: string,
  source: string,
  entityType: string,
  recordsSynced: number,
  cursor?: string | null
): Promise<SyncJobRow> {
  const [row] = await sql`
    UPDATE sync_jobs SET
      status          = 'success',
      records_synced  = ${recordsSynced},
      last_synced_at  = NOW(),
      finished_at     = NOW(),
      cursor          = ${cursor ?? null},
      error_message   = NULL
    WHERE tenant_id = ${tenantId} AND source = ${source} AND entity_type = ${entityType}
    RETURNING *
  `;
  return mapRow(row);
}

export async function markSyncFailed(
  sql: SqlContext,
  tenantId: string,
  source: string,
  entityType: string,
  errorMessage: string
): Promise<SyncJobRow> {
  const [row] = await sql`
    UPDATE sync_jobs SET
      status        = 'failed',
      finished_at   = NOW(),
      error_message = ${errorMessage}
    WHERE tenant_id = ${tenantId} AND source = ${source} AND entity_type = ${entityType}
    RETURNING *
  `;
  return mapRow(row);
}

export async function listSyncJobs(
  sql: SqlContext
): Promise<SyncJobRow[]> {
  const rows = await sql`
    SELECT * FROM sync_jobs ORDER BY entity_type
  `;
  return rows.map(mapRow);
}
