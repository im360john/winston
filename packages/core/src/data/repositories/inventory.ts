/**
 * Inventory repository — all queries automatically tenant-scoped via RLS.
 */

import type { SqlContext } from '../../db/types';

export interface InventoryRow {
  id: string;
  tenantId: string;
  productId: string;
  externalId: string;
  posType: string;
  locationId: string | null;
  locationName: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderPoint: number;
  reorderQuantity: number;
  unitCost: number | null;
  syncedAt: Date;
  updatedAt: Date;
}

export interface UpsertInventoryInput {
  tenantId: string;
  productId: string;
  externalId: string;
  posType: string;
  locationId?: string | null;
  locationName?: string | null;
  quantityOnHand: number;
  quantityReserved?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  unitCost?: number | null;
  rawPayload?: Record<string, unknown>;
}

export interface LowStockItem {
  productId: string;
  productName: string;
  category: string;
  locationName: string | null;
  quantityAvailable: number;
  reorderPoint: number;
  reorderQuantity: number;
}

function mapRow(row: Record<string, unknown>): InventoryRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    productId: row.product_id as string,
    externalId: row.external_id as string,
    posType: row.pos_type as string,
    locationId: row.location_id as string | null,
    locationName: row.location_name as string | null,
    quantityOnHand: row.quantity_on_hand as number,
    quantityReserved: row.quantity_reserved as number,
    quantityAvailable: row.quantity_available as number,
    reorderPoint: row.reorder_point as number,
    reorderQuantity: row.reorder_quantity as number,
    unitCost: row.unit_cost as number | null,
    syncedAt: row.synced_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function upsertInventory(
  sql: SqlContext,
  input: UpsertInventoryInput
): Promise<InventoryRow> {
  const [row] = await sql`
    INSERT INTO inventory_records (
      tenant_id, product_id, external_id, pos_type, location_id, location_name,
      quantity_on_hand, quantity_reserved, reorder_point, reorder_quantity,
      unit_cost, raw_payload, synced_at
    ) VALUES (
      ${input.tenantId}, ${input.productId}, ${input.externalId}, ${input.posType},
      ${input.locationId ?? null}, ${input.locationName ?? null},
      ${input.quantityOnHand}, ${input.quantityReserved ?? 0},
      ${input.reorderPoint ?? 0}, ${input.reorderQuantity ?? 0},
      ${input.unitCost ?? null},
      ${input.rawPayload ? JSON.stringify(input.rawPayload) : null},
      NOW()
    )
    ON CONFLICT (tenant_id, external_id, pos_type) DO UPDATE SET
      product_id        = EXCLUDED.product_id,
      location_id       = EXCLUDED.location_id,
      location_name     = EXCLUDED.location_name,
      quantity_on_hand  = EXCLUDED.quantity_on_hand,
      quantity_reserved = EXCLUDED.quantity_reserved,
      reorder_point     = EXCLUDED.reorder_point,
      reorder_quantity  = EXCLUDED.reorder_quantity,
      unit_cost         = EXCLUDED.unit_cost,
      raw_payload       = EXCLUDED.raw_payload,
      synced_at         = NOW()
    RETURNING *
  `;
  return mapRow(row);
}

export async function listInventory(
  sql: SqlContext,
  options: { locationId?: string; lowStockOnly?: boolean; limit?: number; offset?: number } = {}
): Promise<InventoryRow[]> {
  const rows = await sql`
    SELECT ir.* FROM inventory_records ir
    WHERE TRUE
      ${options.locationId ? sql`AND ir.location_id = ${options.locationId}` : sql``}
      ${options.lowStockOnly ? sql`AND ir.quantity_available <= ir.reorder_point` : sql``}
    ORDER BY ir.quantity_available ASC
    LIMIT ${options.limit ?? 200} OFFSET ${options.offset ?? 0}
  `;
  return rows.map(mapRow);
}

export async function getLowStockItems(
  sql: SqlContext
): Promise<LowStockItem[]> {
  const rows = await sql`
    SELECT
      ir.product_id,
      p.name AS product_name,
      p.category,
      ir.location_name,
      ir.quantity_available,
      ir.reorder_point,
      ir.reorder_quantity
    FROM inventory_records ir
    JOIN products p ON p.id = ir.product_id
    WHERE ir.quantity_available <= ir.reorder_point
    ORDER BY ir.quantity_available ASC
  `;
  return rows.map((r) => ({
    productId: r.product_id as string,
    productName: r.product_name as string,
    category: r.category as string,
    locationName: r.location_name as string | null,
    quantityAvailable: r.quantity_available as number,
    reorderPoint: r.reorder_point as number,
    reorderQuantity: r.reorder_quantity as number,
  }));
}

export async function getInventoryByProductId(
  sql: SqlContext,
  productId: string
): Promise<InventoryRow[]> {
  const rows = await sql`
    SELECT * FROM inventory_records WHERE product_id = ${productId}
  `;
  return rows.map(mapRow);
}
