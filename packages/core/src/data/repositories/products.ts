/**
 * Products repository — all queries automatically tenant-scoped via RLS.
 */

import type { SqlContext } from '../../db/types';

export interface ProductRow {
  id: string;
  tenantId: string;
  externalId: string;
  posType: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  sku: string | null;
  barcode: string | null;
  priceRetail: number | null;
  priceWholesale: number | null;
  thcPercentage: number | null;
  cbdPercentage: number | null;
  weightGrams: number | null;
  unitOfMeasure: string | null;
  metrcTag: string | null;
  isActive: boolean;
  syncedAt: Date;
  updatedAt: Date;
}

export interface UpsertProductInput {
  tenantId: string;
  externalId: string;
  posType: string;
  name: string;
  brand?: string | null;
  category: string;
  subcategory?: string | null;
  sku?: string | null;
  barcode?: string | null;
  priceRetail?: number | null;
  priceWholesale?: number | null;
  thcPercentage?: number | null;
  cbdPercentage?: number | null;
  weightGrams?: number | null;
  unitOfMeasure?: string | null;
  metrcTag?: string | null;
  isActive?: boolean;
  rawPayload?: Record<string, unknown>;
}

export interface ProductFilter {
  category?: string;
  isActive?: boolean;
  metrcTag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

function mapRow(row: Record<string, unknown>): ProductRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    externalId: row.external_id as string,
    posType: row.pos_type as string,
    name: row.name as string,
    brand: row.brand as string | null,
    category: row.category as string,
    subcategory: row.subcategory as string | null,
    sku: row.sku as string | null,
    barcode: row.barcode as string | null,
    priceRetail: row.price_retail as number | null,
    priceWholesale: row.price_wholesale as number | null,
    thcPercentage: row.thc_percentage as number | null,
    cbdPercentage: row.cbd_percentage as number | null,
    weightGrams: row.weight_grams as number | null,
    unitOfMeasure: row.unit_of_measure as string | null,
    metrcTag: row.metrc_tag as string | null,
    isActive: row.is_active as boolean,
    syncedAt: row.synced_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function upsertProduct(
  sql: SqlContext,
  input: UpsertProductInput
): Promise<ProductRow> {
  const [row] = await sql`
    INSERT INTO products (
      tenant_id, external_id, pos_type, name, brand, category, subcategory,
      sku, barcode, price_retail, price_wholesale, thc_percentage, cbd_percentage,
      weight_grams, unit_of_measure, metrc_tag, is_active, raw_payload, synced_at
    ) VALUES (
      ${input.tenantId}, ${input.externalId}, ${input.posType}, ${input.name},
      ${input.brand ?? null}, ${input.category}, ${input.subcategory ?? null},
      ${input.sku ?? null}, ${input.barcode ?? null},
      ${input.priceRetail ?? null}, ${input.priceWholesale ?? null},
      ${input.thcPercentage ?? null}, ${input.cbdPercentage ?? null},
      ${input.weightGrams ?? null}, ${input.unitOfMeasure ?? null},
      ${input.metrcTag ?? null}, ${input.isActive ?? true},
      ${input.rawPayload ? JSON.stringify(input.rawPayload) : null},
      NOW()
    )
    ON CONFLICT (tenant_id, external_id, pos_type) DO UPDATE SET
      name            = EXCLUDED.name,
      brand           = EXCLUDED.brand,
      category        = EXCLUDED.category,
      subcategory     = EXCLUDED.subcategory,
      sku             = EXCLUDED.sku,
      barcode         = EXCLUDED.barcode,
      price_retail    = EXCLUDED.price_retail,
      price_wholesale = EXCLUDED.price_wholesale,
      thc_percentage  = EXCLUDED.thc_percentage,
      cbd_percentage  = EXCLUDED.cbd_percentage,
      weight_grams    = EXCLUDED.weight_grams,
      unit_of_measure = EXCLUDED.unit_of_measure,
      metrc_tag       = EXCLUDED.metrc_tag,
      is_active       = EXCLUDED.is_active,
      raw_payload     = EXCLUDED.raw_payload,
      synced_at       = NOW()
    RETURNING *
  `;
  return mapRow(row);
}

export async function listProducts(
  sql: SqlContext,
  filter: ProductFilter = {}
): Promise<ProductRow[]> {
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;

  // Build dynamic WHERE clauses
  const rows = await sql`
    SELECT * FROM products
    WHERE TRUE
      ${filter.category ? sql`AND category = ${filter.category}` : sql``}
      ${filter.isActive !== undefined ? sql`AND is_active = ${filter.isActive}` : sql``}
      ${filter.metrcTag ? sql`AND metrc_tag = ${filter.metrcTag}` : sql``}
      ${filter.search ? sql`AND name ILIKE ${'%' + filter.search + '%'}` : sql``}
    ORDER BY name
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map(mapRow);
}

export async function getProductByExternalId(
  sql: SqlContext,
  externalId: string,
  posType: string
): Promise<ProductRow | null> {
  const rows = await sql`
    SELECT * FROM products WHERE external_id = ${externalId} AND pos_type = ${posType}
  `;
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function getProductByMetrcTag(
  sql: SqlContext,
  metrcTag: string
): Promise<ProductRow | null> {
  const rows = await sql`SELECT * FROM products WHERE metrc_tag = ${metrcTag} LIMIT 1`;
  return rows.length > 0 ? mapRow(rows[0]) : null;
}
