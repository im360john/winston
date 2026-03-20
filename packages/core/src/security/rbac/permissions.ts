/**
 * RBAC permission matrix for Winston.
 *
 * Cannabis retail roles and what each can do.
 * Permissions are checked at the Express middleware layer — not UI.
 */

import { Role, Permission } from '../../types/security';

/**
 * Full permission set for each role.
 * Roles are additive within a tier but explicitly defined to avoid surprises.
 */
export const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  admin: new Set<Permission>([
    'inventory:read', 'inventory:write',
    'orders:read', 'orders:write',
    'sales:read', 'sales:write',
    'reports:read',
    'compliance:read', 'compliance:write',
    'staff:read', 'staff:write',
    'config:read', 'config:write',
    'secrets:read', 'secrets:write',
  ]),

  manager: new Set<Permission>([
    'inventory:read', 'inventory:write',
    'orders:read', 'orders:write',
    'sales:read', 'sales:write',
    'reports:read',
    'compliance:read',
    'staff:read',
    'config:read',
  ]),

  budtender: new Set<Permission>([
    'inventory:read',
    'sales:read', 'sales:write',
  ]),

  viewer: new Set<Permission>([
    'inventory:read',
    'orders:read',
    'sales:read',
    'reports:read',
    'compliance:read',
    'staff:read',
    'config:read',
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
