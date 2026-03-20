/**
 * JWT utilities for Winston authentication.
 *
 * Uses HMAC-SHA256 (HS256) signed tokens. The signing secret is loaded
 * from WINSTON_JWT_SECRET at startup — never hardcoded.
 *
 * Token payload: { sub, tenantId, role, iat, exp }
 */

import * as crypto from 'crypto';
import { TokenPayload, Role } from '../../types/security';

const ALG = 'HS256';
const DEFAULT_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function getSecret(): string {
  const secret = process.env.WINSTON_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'WINSTON_JWT_SECRET must be set and at least 32 characters. ' +
      'Generate with: openssl rand -hex 32'
    );
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeBase64url(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

export interface CreateTokenOptions {
  ttlSeconds?: number;
}

export function createToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  options: CreateTokenOptions = {}
): string {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  const header = base64url(JSON.stringify({ alg: ALG, typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + ttl,
  }));
  const signingInput = `${header}.${claims}`;
  const sig = base64url(
    crypto.createHmac('sha256', secret).update(signingInput).digest()
  );

  return `${signingInput}.${sig}`;
}

export class AuthError extends Error {
  constructor(message: string, public readonly code: 'MISSING' | 'INVALID' | 'EXPIRED') {
    super(message);
    this.name = 'AuthError';
  }
}

export function verifyToken(token: string): TokenPayload {
  if (!token) {
    throw new AuthError('No token provided', 'MISSING');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthError('Malformed token', 'INVALID');
  }

  const [header, claims, sig] = parts;
  const signingInput = `${header}.${claims}`;
  const secret = getSecret();
  const expectedSig = base64url(
    crypto.createHmac('sha256', secret).update(signingInput).digest()
  );

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    throw new AuthError('Invalid token signature', 'INVALID');
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(decodeBase64url(claims)) as TokenPayload;
  } catch {
    throw new AuthError('Token payload is not valid JSON', 'INVALID');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp !== undefined && now > payload.exp) {
    throw new AuthError('Token has expired', 'EXPIRED');
  }

  if (!payload.sub || !payload.tenantId || !payload.role) {
    throw new AuthError('Token missing required claims (sub, tenantId, role)', 'INVALID');
  }

  return payload;
}

const VALID_ROLES: Set<Role> = new Set(['admin', 'manager', 'budtender', 'viewer']);

export function isValidRole(role: string): role is Role {
  return VALID_ROLES.has(role as Role);
}
