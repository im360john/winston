/**
 * Tenant isolation tests.
 */

import { assertTenantScope, TenantScopeError } from '../../src/security/tenant/middleware';
import { Request } from 'express';

function makeReq(tenantId: string): Request {
  return {
    tenantContext: { tenantId, userId: 'user-1', role: 'admin' },
  } as unknown as Request;
}

describe('assertTenantScope', () => {
  test('passes when tenantIds match', () => {
    expect(() => assertTenantScope(makeReq('tenant-a'), 'tenant-a')).not.toThrow();
  });

  test('throws TenantScopeError when tenantIds differ', () => {
    expect(() => assertTenantScope(makeReq('tenant-a'), 'tenant-b'))
      .toThrow(TenantScopeError);
  });

  test('throws when no tenant context', () => {
    const req = {} as Request;
    expect(() => assertTenantScope(req, 'tenant-a')).toThrow(TenantScopeError);
  });

  test('error message contains both tenant IDs', () => {
    try {
      assertTenantScope(makeReq('tenant-a'), 'tenant-b');
    } catch (err) {
      expect((err as TenantScopeError).message).toContain('tenant-a');
      expect((err as TenantScopeError).message).toContain('tenant-b');
    }
  });
});
