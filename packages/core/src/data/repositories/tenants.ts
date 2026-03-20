/**
 * Tenants repository — no RLS, admin-level operations.
 */

import { getPool } from '../../db/client';

export interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  stateCode: string;
  licenseNumber: string | null;
  metrcLicense: string | null;
  posType: string;
  timezone: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantInput {
  slug: string;
  displayName: string;
  stateCode: string;
  licenseNumber?: string;
  metrcLicense?: string;
  posType: string;
  timezone?: string;
}

function mapRow(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    slug: row.slug as string,
    displayName: row.display_name as string,
    stateCode: row.state_code as string,
    licenseNumber: row.license_number as string | null,
    metrcLicense: row.metrc_license as string | null,
    posType: row.pos_type as string,
    timezone: row.timezone as string,
    active: row.active as boolean,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  const sql = getPool();
  const [row] = await sql`
    INSERT INTO tenants (slug, display_name, state_code, license_number, metrc_license, pos_type, timezone)
    VALUES (
      ${input.slug},
      ${input.displayName},
      ${input.stateCode},
      ${input.licenseNumber ?? null},
      ${input.metrcLicense ?? null},
      ${input.posType},
      ${input.timezone ?? 'America/Los_Angeles'}
    )
    RETURNING *
  `;
  return mapRow(row);
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const sql = getPool();
  const rows = await sql`SELECT * FROM tenants WHERE id = ${id} AND active = TRUE`;
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const sql = getPool();
  const rows = await sql`SELECT * FROM tenants WHERE slug = ${slug} AND active = TRUE`;
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function listTenants(): Promise<Tenant[]> {
  const sql = getPool();
  const rows = await sql`SELECT * FROM tenants WHERE active = TRUE ORDER BY display_name`;
  return rows.map(mapRow);
}

export async function deactivateTenant(id: string): Promise<void> {
  const sql = getPool();
  await sql`UPDATE tenants SET active = FALSE WHERE id = ${id}`;
}
