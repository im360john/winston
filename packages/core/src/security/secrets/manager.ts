/**
 * Encrypted secrets manager for Winston.
 *
 * Encrypts retailer credentials (POS API keys, METRC tokens, etc.) using
 * AES-256-GCM with per-tenant derived keys. Master key from env only.
 *
 * Key derivation: HKDF(masterKey, salt=tenantId, info="winston-secret", len=32)
 * This ensures a compromised tenant's derived key cannot decrypt other tenants.
 *
 * Storage: secrets are stored as JSON objects with { iv, ciphertext, tag, version }.
 * In production this store would be backed by a database; here it's an in-memory
 * Map (swap out SecretsStore interface for your persistence layer).
 */

import * as crypto from 'crypto';
import { EncryptedSecret } from '../../types/security';

const ALGORITHM = 'aes-256-gcm';
const KEY_VERSION = 1;

function getMasterKey(): Buffer {
  const raw = process.env.WINSTON_MASTER_KEY;
  if (!raw) {
    throw new Error(
      'WINSTON_MASTER_KEY must be set. Generate with: openssl rand -hex 32'
    );
  }
  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== 32) {
    throw new Error('WINSTON_MASTER_KEY must be 32 bytes (64 hex chars)');
  }
  return buf;
}

/**
 * Derive a per-tenant 256-bit key using HKDF.
 * Node's built-in hkdfSync is available from v15.
 */
function deriveKey(tenantId: string): Buffer {
  const masterKey = getMasterKey();
  const salt = crypto.createHash('sha256').update(tenantId).digest();
  const info = Buffer.from('winston-secrets-v1');
  return Buffer.from(
    crypto.hkdfSync('sha256', masterKey, salt, info, 32)
  );
}

export function encryptSecret(value: string, tenantId: string): EncryptedSecret {
  const key = deriveKey(tenantId);
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
    tag: tag.toString('hex'),
    version: KEY_VERSION,
  };
}

export function decryptSecret(encrypted: EncryptedSecret, tenantId: string): string {
  if (encrypted.version !== KEY_VERSION) {
    throw new Error(`Unknown key version: ${encrypted.version}`);
  }

  const key = deriveKey(tenantId);
  const iv = Buffer.from(encrypted.iv, 'hex');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Decryption failed — ciphertext may be tampered or key mismatch');
  }
}

// ---- In-memory store (swap for DB in production) -------------------------

interface SecretsStore {
  set(tenantId: string, key: string, encrypted: EncryptedSecret): void;
  get(tenantId: string, key: string): EncryptedSecret | undefined;
  delete(tenantId: string, key: string): void;
  listKeys(tenantId: string): string[];
}

class InMemorySecretsStore implements SecretsStore {
  private store = new Map<string, EncryptedSecret>();

  private storeKey(tenantId: string, key: string): string {
    return `${tenantId}::${key}`;
  }

  set(tenantId: string, key: string, encrypted: EncryptedSecret): void {
    this.store.set(this.storeKey(tenantId, key), encrypted);
  }

  get(tenantId: string, key: string): EncryptedSecret | undefined {
    return this.store.get(this.storeKey(tenantId, key));
  }

  delete(tenantId: string, key: string): void {
    this.store.delete(this.storeKey(tenantId, key));
  }

  listKeys(tenantId: string): string[] {
    const prefix = `${tenantId}::`;
    return Array.from(this.store.keys())
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
  }
}

// ---- SecretsManager public API -------------------------------------------

export class SecretsManager {
  constructor(private readonly store: SecretsStore = new InMemorySecretsStore()) {}

  /** Store a plaintext secret encrypted under the tenant's derived key. */
  set(tenantId: string, key: string, value: string): void {
    const encrypted = encryptSecret(value, tenantId);
    this.store.set(tenantId, key, encrypted);
  }

  /** Retrieve and decrypt a secret. Returns undefined if not found. */
  get(tenantId: string, key: string): string | undefined {
    const encrypted = this.store.get(tenantId, key);
    if (!encrypted) return undefined;
    return decryptSecret(encrypted, tenantId);
  }

  /** Delete a secret. */
  delete(tenantId: string, key: string): void {
    this.store.delete(tenantId, key);
  }

  /** List all secret keys for a tenant (not values). */
  listKeys(tenantId: string): string[] {
    return this.store.listKeys(tenantId);
  }
}

// Singleton instance
export const secretsManager = new SecretsManager();
