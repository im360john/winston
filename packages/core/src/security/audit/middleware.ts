/**
 * Audit logging Express middleware.
 *
 * Attaches to every request after auth + tenant middleware.
 * Records outcome (success/denied/error) after response finishes.
 *
 * Route pattern normalization: strips numeric IDs so logs aggregate cleanly.
 * E.g., GET /api/inventory/123/products -> "GET /api/inventory/:id/products"
 */

import { Request, Response, NextFunction } from 'express';
import { writeAuditEntry, buildAuditEntry } from './logger';
import { AuditOutcome } from '../../types/security';

const ID_PATTERN = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/gi;
const NUMERIC_ID_PATTERN = /\/\d+(\/|$)/g;

function normalizeRoute(req: Request): string {
  const route = req.route?.path ?? req.path;
  const normalized = route
    .replace(ID_PATTERN, '/:id$1')
    .replace(NUMERIC_ID_PATTERN, '/:id$1');
  return `${req.method} ${normalized}`;
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startMs = Date.now();

  res.on('finish', () => {
    // If no tenant context, auth middleware rejected the request — still log it
    const ctx = req.tenantContext ?? {
      tenantId: 'unauthenticated',
      userId: 'anonymous',
      role: 'viewer' as const,
    };

    let outcome: AuditOutcome;
    if (res.statusCode >= 500) {
      outcome = 'error';
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      outcome = 'denied';
    } else {
      outcome = 'success';
    }

    const entry = buildAuditEntry(ctx, normalizeRoute(req), outcome, {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        ?? req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startMs,
      errorMessage: outcome === 'error' ? `HTTP ${res.statusCode}` : undefined,
    });

    writeAuditEntry(entry);
  });

  next();
}
