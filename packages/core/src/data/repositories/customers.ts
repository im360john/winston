/**
 * Customers repository — tenant-scoped via RLS.
 */

import type { SqlContext } from '../../db/types';

export interface CustomerRow {
  id: string;
  tenantId: string;
  externalId: string;
  posType: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  customerType: string;
  loyaltyPoints: number;
  loyaltyTier: string | null;
  totalSpend: number;
  visitCount: number;
  lastVisitAt: Date | null;
  optInSms: boolean;
  optInEmail: boolean;
  syncedAt: Date;
  updatedAt: Date;
}

export interface UpsertCustomerInput {
  tenantId: string;
  externalId: string;
  posType: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  idType?: string | null;
  idNumberHash?: string | null;       // caller must hash before passing
  customerType?: string;
  loyaltyPoints?: number;
  loyaltyTier?: string | null;
  totalSpend?: number;
  visitCount?: number;
  lastVisitAt?: Date | null;
  optInSms?: boolean;
  optInEmail?: boolean;
  rawPayload?: Record<string, unknown>;
}

export interface CustomerFilter {
  customerType?: string;
  loyaltyTier?: string;
  email?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

function mapRow(row: Record<string, unknown>): CustomerRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    externalId: row.external_id as string,
    posType: row.pos_type as string,
    firstName: row.first_name as string | null,
    lastName: row.last_name as string | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
    customerType: row.customer_type as string,
    loyaltyPoints: row.loyalty_points as number,
    loyaltyTier: row.loyalty_tier as string | null,
    totalSpend: row.total_spend as number,
    visitCount: row.visit_count as number,
    lastVisitAt: row.last_visit_at as Date | null,
    optInSms: row.opt_in_sms as boolean,
    optInEmail: row.opt_in_email as boolean,
    syncedAt: row.synced_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function upsertCustomer(
  sql: SqlContext,
  input: UpsertCustomerInput
): Promise<CustomerRow> {
  const [row] = await sql`
    INSERT INTO customers (
      tenant_id, external_id, pos_type, first_name, last_name, email, phone,
      date_of_birth, id_type, id_number_hash, customer_type,
      loyalty_points, loyalty_tier, total_spend, visit_count, last_visit_at,
      opt_in_sms, opt_in_email, raw_payload, synced_at
    ) VALUES (
      ${input.tenantId}, ${input.externalId}, ${input.posType},
      ${input.firstName ?? null}, ${input.lastName ?? null},
      ${input.email ?? null}, ${input.phone ?? null},
      ${input.dateOfBirth ? input.dateOfBirth.toISOString() : null},
      ${input.idType ?? null}, ${input.idNumberHash ?? null},
      ${input.customerType ?? 'recreational'},
      ${input.loyaltyPoints ?? 0}, ${input.loyaltyTier ?? null},
      ${input.totalSpend ?? 0}, ${input.visitCount ?? 0},
      ${input.lastVisitAt ? input.lastVisitAt.toISOString() : null},
      ${input.optInSms ?? false}, ${input.optInEmail ?? false},
      ${input.rawPayload ? JSON.stringify(input.rawPayload) : null},
      NOW()
    )
    ON CONFLICT (tenant_id, external_id, pos_type) DO UPDATE SET
      first_name     = EXCLUDED.first_name,
      last_name      = EXCLUDED.last_name,
      email          = EXCLUDED.email,
      phone          = EXCLUDED.phone,
      customer_type  = EXCLUDED.customer_type,
      loyalty_points = EXCLUDED.loyalty_points,
      loyalty_tier   = EXCLUDED.loyalty_tier,
      total_spend    = EXCLUDED.total_spend,
      visit_count    = EXCLUDED.visit_count,
      last_visit_at  = EXCLUDED.last_visit_at,
      opt_in_sms     = EXCLUDED.opt_in_sms,
      opt_in_email   = EXCLUDED.opt_in_email,
      raw_payload    = EXCLUDED.raw_payload,
      synced_at      = NOW()
    RETURNING *
  `;
  return mapRow(row);
}

export async function listCustomers(
  sql: SqlContext,
  filter: CustomerFilter = {}
): Promise<CustomerRow[]> {
  const rows = await sql`
    SELECT * FROM customers
    WHERE TRUE
      ${filter.customerType ? sql`AND customer_type = ${filter.customerType}` : sql``}
      ${filter.loyaltyTier ? sql`AND loyalty_tier = ${filter.loyaltyTier}` : sql``}
      ${filter.email ? sql`AND email = ${filter.email}` : sql``}
      ${filter.search ? sql`AND (first_name ILIKE ${'%' + filter.search + '%'} OR last_name ILIKE ${'%' + filter.search + '%'} OR email ILIKE ${'%' + filter.search + '%'})` : sql``}
    ORDER BY last_visit_at DESC NULLS LAST
    LIMIT ${filter.limit ?? 100} OFFSET ${filter.offset ?? 0}
  `;
  return rows.map(mapRow);
}

export async function getCustomerByExternalId(
  sql: SqlContext,
  externalId: string,
  posType: string
): Promise<CustomerRow | null> {
  const rows = await sql`
    SELECT * FROM customers WHERE external_id = ${externalId} AND pos_type = ${posType}
  `;
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function getTopCustomers(
  sql: SqlContext,
  limit = 20
): Promise<CustomerRow[]> {
  const rows = await sql`
    SELECT * FROM customers ORDER BY total_spend DESC LIMIT ${limit}
  `;
  return rows.map(mapRow);
}

export async function countCustomersByType(
  sql: SqlContext
): Promise<Record<string, number>> {
  const rows = await sql`
    SELECT customer_type, COUNT(*)::INTEGER AS count
    FROM customers
    GROUP BY customer_type
  `;
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.customer_type as string] = row.count as number;
  }
  return result;
}
