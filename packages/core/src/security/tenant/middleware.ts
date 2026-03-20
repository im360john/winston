/**
 * Tenant isolation middleware and scope assertion utility.
 *
 * tenantMiddleware: validates req.tenantContext is populated (by authMiddleware).
 *   Thin — auth middleware already injects context from JWT.
 *
 * assertTenantScope: call in route handlers to ensure a resource belongs to the
 *   requesting tenant. Throws 403 on mismatch — never leaks cross-tenant data.
 */

import { Request, Response, NextFunction } from 'express';

export class TenantScopeError extends Error {
  constructor(public readonly tenantId: string, resourceTenantId: string) {
    super(
      `Tenant scope violation: request tenant '${tenantId}' attempted to access resource owned by '${resourceTenantId}'`
    );
    this.name = 'TenantScopeError';
  }
}

/**
 * Validates that tenant context is present on every request.
 * Must be applied after authMiddleware.
 */
export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.tenantContext || !req.tenantContext.tenantId) {
    res.status(401).json({ error: 'Tenant context missing — ensure auth middleware runs first' });
    return;
  }
  next();
}

/**
 * Assert that a resource's tenantId matches the requesting tenant.
 * Call this in route handlers before returning any resource data.
 *
 * @throws TenantScopeError (HTTP 403) if tenantIds do not match
 *
 * Example:
 *   assertTenantScope(req, inventory.tenantId);
 */
export function assertTenantScope(req: Request, resourceTenantId: string): void {
  const requestingTenantId = req.tenantContext?.tenantId;
  if (!requestingTenantId) {
    throw new TenantScopeError('(unknown)', resourceTenantId);
  }
  if (requestingTenantId !== resourceTenantId) {
    throw new TenantScopeError(requestingTenantId, resourceTenantId);
  }
}

/**
 * Express error handler for TenantScopeError.
 * Apply after routes to convert scope violations into 403 responses.
 */
export function tenantScopeErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof TenantScopeError) {
    res.status(403).json({ error: 'Forbidden — cross-tenant access denied' });
    return;
  }
  next(err);
}
