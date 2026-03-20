/**
 * Express authentication middleware.
 *
 * Expects Authorization: Bearer <token> header.
 * On success, attaches req.tenantContext (populated by tenant middleware downstream).
 * On failure, responds 401 with a JSON error.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthError } from './jwt';
import { TenantContext } from '../../types/security';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    // Attach tenant context for downstream middleware
    req.tenantContext = {
      tenantId: payload.tenantId,
      userId: payload.sub,
      role: payload.role,
    } satisfies TenantContext;
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === 'EXPIRED' ? 401 : 401;
      res.status(status).json({ error: err.message, code: err.code });
    } else {
      res.status(401).json({ error: 'Authentication failed' });
    }
  }
}
