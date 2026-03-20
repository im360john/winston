/**
 * Winston security type definitions.
 * Shared across auth, RBAC, audit, tenant, and secrets modules.
 */

// ---- Roles ---------------------------------------------------------------

export type Role = 'admin' | 'manager' | 'budtender' | 'viewer';

// ---- Permissions ---------------------------------------------------------

export type Permission =
  // Inventory
  | 'inventory:read'
  | 'inventory:write'
  // Orders / purchasing
  | 'orders:read'
  | 'orders:write'
  // Sales / POS
  | 'sales:read'
  | 'sales:write'
  // Reports
  | 'reports:read'
  // Compliance / METRC
  | 'compliance:read'
  | 'compliance:write'
  // Staff management
  | 'staff:read'
  | 'staff:write'
  // System configuration
  | 'config:read'
  | 'config:write'
  // Secrets / credentials
  | 'secrets:read'
  | 'secrets:write';

// ---- JWT payload ---------------------------------------------------------

export interface TokenPayload {
  sub: string;        // userId
  tenantId: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// ---- Tenant context -------------------------------------------------------

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: Role;
}

// ---- Audit log entry -----------------------------------------------------

export type AuditOutcome = 'success' | 'denied' | 'error';

export interface AuditEntry {
  timestamp: string;        // ISO 8601
  tenantId: string;
  userId: string;
  role: Role;
  action: string;           // "GET /api/inventory"
  resourceType?: string;
  resourceId?: string;
  outcome: AuditOutcome;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
  errorMessage?: string;
}

// ---- Encrypted secret ----------------------------------------------------

export interface EncryptedSecret {
  iv: string;           // hex-encoded
  ciphertext: string;   // hex-encoded
  tag: string;          // hex-encoded GCM auth tag
  version: number;      // key version for rotation
}

// ---- Express augmentation ------------------------------------------------

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}
