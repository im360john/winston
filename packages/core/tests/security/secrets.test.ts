/**
 * Secrets manager tests.
 */

import { encryptSecret, decryptSecret, SecretsManager } from '../../src/security/secrets/manager';

const MASTER_KEY = Buffer.alloc(32, 0xab).toString('hex'); // 32-byte test key

beforeAll(() => {
  process.env.WINSTON_MASTER_KEY = MASTER_KEY;
});

afterAll(() => {
  delete process.env.WINSTON_MASTER_KEY;
});

describe('encryptSecret / decryptSecret', () => {
  test('round-trips a plaintext secret', () => {
    const value = 'super-secret-api-key-12345';
    const encrypted = encryptSecret(value, 'tenant-a');
    const decrypted = decryptSecret(encrypted, 'tenant-a');
    expect(decrypted).toBe(value);
  });

  test('ciphertext is not plaintext', () => {
    const value = 'plaintext-secret';
    const encrypted = encryptSecret(value, 'tenant-a');
    expect(encrypted.ciphertext).not.toContain(value);
    expect(JSON.stringify(encrypted)).not.toContain(value);
  });

  test('different tenants produce different ciphertexts for same value', () => {
    const value = 'same-secret';
    const a = encryptSecret(value, 'tenant-a');
    const b = encryptSecret(value, 'tenant-b');
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  test('tenant-b cannot decrypt tenant-a ciphertext', () => {
    const value = 'cross-tenant-secret';
    const encrypted = encryptSecret(value, 'tenant-a');
    expect(() => decryptSecret(encrypted, 'tenant-b')).toThrow();
  });

  test('tampered ciphertext fails authentication', () => {
    const value = 'integrity-check';
    const encrypted = encryptSecret(value, 'tenant-a');
    const tampered = { ...encrypted, ciphertext: encrypted.ciphertext.slice(0, -2) + 'ff' };
    expect(() => decryptSecret(tampered, 'tenant-a')).toThrow();
  });

  test('each encryption uses a unique IV', () => {
    const value = 'same-value';
    const a = encryptSecret(value, 'tenant-a');
    const b = encryptSecret(value, 'tenant-a');
    expect(a.iv).not.toBe(b.iv);
  });
});

describe('SecretsManager', () => {
  let mgr: SecretsManager;

  beforeEach(() => {
    mgr = new SecretsManager();
  });

  test('set and get round-trips', () => {
    mgr.set('tenant-x', 'treez_api_key', 'key-abc-123');
    expect(mgr.get('tenant-x', 'treez_api_key')).toBe('key-abc-123');
  });

  test('returns undefined for unknown key', () => {
    expect(mgr.get('tenant-x', 'nonexistent')).toBeUndefined();
  });

  test('tenant isolation: tenant-b cannot read tenant-a secrets', () => {
    mgr.set('tenant-a', 'secret', 'a-value');
    // tenant-b has no key 'secret'
    expect(mgr.get('tenant-b', 'secret')).toBeUndefined();
  });

  test('listKeys returns keys for tenant without revealing values', () => {
    mgr.set('tenant-a', 'key1', 'val1');
    mgr.set('tenant-a', 'key2', 'val2');
    mgr.set('tenant-b', 'key3', 'val3');
    const keys = mgr.listKeys('tenant-a');
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
    expect(keys).not.toContain('key3');
  });

  test('delete removes a secret', () => {
    mgr.set('tenant-a', 'temp', 'temp-val');
    mgr.delete('tenant-a', 'temp');
    expect(mgr.get('tenant-a', 'temp')).toBeUndefined();
  });
});
