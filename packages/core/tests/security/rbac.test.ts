/**
 * RBAC permission matrix tests.
 */

import { hasPermission, ROLE_PERMISSIONS } from '../../src/security/rbac/permissions';
import { Role, Permission } from '../../src/types/security';

describe('hasPermission', () => {
  test('admin has all permissions', () => {
    const allPerms: Permission[] = [
      'inventory:read', 'inventory:write',
      'orders:read', 'orders:write',
      'sales:read', 'sales:write',
      'reports:read',
      'compliance:read', 'compliance:write',
      'staff:read', 'staff:write',
      'config:read', 'config:write',
      'secrets:read', 'secrets:write',
    ];
    allPerms.forEach(p => {
      expect(hasPermission('admin', p)).toBe(true);
    });
  });

  test('budtender cannot read reports', () => {
    expect(hasPermission('budtender', 'reports:read')).toBe(false);
  });

  test('budtender cannot access compliance', () => {
    expect(hasPermission('budtender', 'compliance:read')).toBe(false);
  });

  test('budtender can write sales', () => {
    expect(hasPermission('budtender', 'sales:write')).toBe(true);
  });

  test('viewer cannot write anything', () => {
    const writePerms: Permission[] = [
      'inventory:write', 'orders:write', 'sales:write',
      'compliance:write', 'staff:write', 'config:write', 'secrets:write',
    ];
    writePerms.forEach(p => {
      expect(hasPermission('viewer', p)).toBe(false);
    });
  });

  test('manager cannot manage staff', () => {
    expect(hasPermission('manager', 'staff:write')).toBe(false);
  });

  test('manager can manage inventory', () => {
    expect(hasPermission('manager', 'inventory:write')).toBe(true);
  });

  test('manager cannot access secrets', () => {
    expect(hasPermission('manager', 'secrets:read')).toBe(false);
    expect(hasPermission('manager', 'secrets:write')).toBe(false);
  });

  test('only admin can manage secrets', () => {
    const roles: Role[] = ['manager', 'budtender', 'viewer'];
    roles.forEach(role => {
      expect(hasPermission(role, 'secrets:read')).toBe(false);
    });
    expect(hasPermission('admin', 'secrets:read')).toBe(true);
  });
});
