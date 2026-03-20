/**
 * RBAC enforcement middleware.
 *
 * Usage:
 *   router.get('/inventory', authMiddleware, rbacMiddleware('inventory:read'), handler)
 *
 * Requires req.tenantContext to be set (by authMiddleware first).
 * Returns 403 if role lacks the required permission.
 */

import { Request, Response, NextFunction } from 'express';
import { Permission } from '../../types/security';
import { hasPermission } from './permissions';

export function rbacMiddleware(required: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx = req.tenantContext;
    if (!ctx) {
      // authMiddleware must run first
      res.status(401).json({ error: 'Unauthenticated — auth middleware not applied' });
      return;
    }

    if (!hasPermission(ctx.role, required)) {
      res.status(403).json({
        error: `Forbidden — role '${ctx.role}' does not have permission '${required}'`,
        required,
        role: ctx.role,
      });
      return;
    }

    next();
  };
}
