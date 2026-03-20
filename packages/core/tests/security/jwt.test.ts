/**
 * JWT utility tests.
 */

import { createToken, verifyToken, AuthError } from '../../src/security/auth/jwt';

const SECRET = 'a'.repeat(32); // 32-char test secret

beforeAll(() => {
  process.env.WINSTON_JWT_SECRET = SECRET;
});

afterAll(() => {
  delete process.env.WINSTON_JWT_SECRET;
});

describe('createToken / verifyToken', () => {
  test('round-trips a valid token', () => {
    const token = createToken({ sub: 'user-1', tenantId: 'tenant-a', role: 'admin' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.tenantId).toBe('tenant-a');
    expect(payload.role).toBe('admin');
  });

  test('rejects missing token', () => {
    expect(() => verifyToken('')).toThrow(AuthError);
  });

  test('rejects tampered signature', () => {
    const token = createToken({ sub: 'u', tenantId: 't', role: 'viewer' });
    const parts = token.split('.');
    parts[2] = parts[2].split('').reverse().join(''); // corrupt signature
    expect(() => verifyToken(parts.join('.'))).toThrow(AuthError);
  });

  test('rejects expired token', () => {
    const token = createToken({ sub: 'u', tenantId: 't', role: 'viewer' }, { ttlSeconds: -1 });
    expect(() => verifyToken(token)).toThrow(AuthError);
  });

  test('rejects malformed token', () => {
    expect(() => verifyToken('not.a.token.at.all')).toThrow(AuthError);
  });

  test('rejects token with missing claims', () => {
    // Manually craft token without tenantId
    const bad = createToken({ sub: 'u', tenantId: '', role: 'viewer' });
    expect(() => verifyToken(bad)).toThrow(AuthError);
  });
});

describe('WINSTON_JWT_SECRET validation', () => {
  test('throws on short secret', () => {
    process.env.WINSTON_JWT_SECRET = 'tooshort';
    expect(() => createToken({ sub: 'u', tenantId: 't', role: 'admin' })).toThrow();
    process.env.WINSTON_JWT_SECRET = SECRET;
  });
});
