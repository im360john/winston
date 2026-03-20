/**
 * Audit logger for Winston.
 *
 * Writes append-only JSONL audit entries per tenant to:
 *   logs/{tenantId}/audit.jsonl
 *
 * Also emits an 'audit' event on the exported emitter for downstream
 * consumers (e.g., a SIEM forwarder, aggregation pipeline).
 *
 * Secrets and passwords are NEVER included in audit logs — callers must
 * sanitize sensitive fields before passing to this logger.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { AuditEntry, AuditOutcome, TenantContext } from '../../types/security';

export const auditEmitter = new EventEmitter();

const LOG_BASE_DIR = process.env.WINSTON_AUDIT_LOG_DIR ?? path.join(process.cwd(), 'logs');

function ensureLogDir(tenantId: string): string {
  const dir = path.join(LOG_BASE_DIR, tenantId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeAuditEntry(entry: AuditEntry): void {
  try {
    const dir = ensureLogDir(entry.tenantId);
    const logPath = path.join(dir, 'audit.jsonl');
    const line = JSON.stringify(entry) + '\n';

    // Append-only: never truncate or overwrite
    fs.appendFileSync(logPath, line, { encoding: 'utf8', flag: 'a' });

    // Emit for downstream consumers
    auditEmitter.emit('audit', entry);
  } catch (err) {
    // Audit failures must not crash the application, but must be visible
    console.error('[AUDIT ERROR] Failed to write audit entry:', err, entry);
  }
}

export function buildAuditEntry(
  ctx: TenantContext,
  action: string,
  outcome: AuditOutcome,
  options: {
    resourceType?: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    durationMs?: number;
    errorMessage?: string;
  } = {}
): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    role: ctx.role,
    action,
    outcome,
    ...options,
  };
}
