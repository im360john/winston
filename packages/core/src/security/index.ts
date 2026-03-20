/**
 * Winston security stack — single import for all security middleware.
 *
 * Apply the base stack to every route:
 *   app.use(securityStack)
 *
 * Then add rbacMiddleware per-route:
 *   router.get('/inventory', rbacMiddleware('inventory:read'), handler)
 */

export { createToken, verifyToken, AuthError } from './auth/jwt';
export { authMiddleware } from './auth/middleware';
export { rbacMiddleware } from './rbac/middleware';
export { hasPermission, ROLE_PERMISSIONS } from './rbac/permissions';
export { tenantMiddleware, assertTenantScope, TenantScopeError, tenantScopeErrorHandler } from './tenant/middleware';
export { auditMiddleware } from './audit/middleware';
export { writeAuditEntry, buildAuditEntry, auditEmitter } from './audit/logger';
export { SecretsManager, secretsManager, encryptSecret, decryptSecret } from './secrets/manager';

import { RequestHandler } from 'express';
import { auditMiddleware } from './audit/middleware';
import { authMiddleware } from './auth/middleware';
import { tenantMiddleware } from './tenant/middleware';

/**
 * Ordered security middleware stack.
 * Applied in sequence: audit -> auth -> tenant.
 *
 * Audit runs first so even rejected requests are logged.
 */
export const securityStack: RequestHandler[] = [
  auditMiddleware,
  authMiddleware,
  tenantMiddleware,
];
