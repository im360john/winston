/**
 * METRC repository — packages and transfers, tenant-scoped via RLS.
 */

import type { SqlContext } from '../../db/types';

export interface MetrcPackageRow {
  id: string;
  tenantId: string;
  label: string;
  packageType: string;
  itemName: string | null;
  itemCategory: string | null;
  quantity: number;
  unitOfMeasure: string | null;
  isActive: boolean;
  packagedDate: Date | null;
  useByDate: Date | null;
  labTestingState: string | null;
  thcPercentage: number | null;
  cbdPercentage: number | null;
  sourceHarvestName: string | null;
  licenseNumber: string | null;
  syncedAt: Date;
  updatedAt: Date;
}

export interface UpsertMetrcPackageInput {
  tenantId: string;
  label: string;
  packageType?: string;
  itemName?: string | null;
  itemCategory?: string | null;
  quantity: number;
  unitOfMeasure?: string | null;
  isActive?: boolean;
  packagedDate?: Date | null;
  useByDate?: Date | null;
  labTestingState?: string | null;
  thcPercentage?: number | null;
  cbdPercentage?: number | null;
  sourceHarvestName?: string | null;
  licenseNumber?: string | null;
  rawPayload?: Record<string, unknown>;
}

export interface MetrcTransferRow {
  id: string;
  tenantId: string;
  manifestNumber: string;
  transferType: string;
  shipperName: string | null;
  shipperLicense: string | null;
  recipientName: string | null;
  recipientLicense: string | null;
  departedAt: Date | null;
  receivedAt: Date | null;
  packageCount: number | null;
  syncedAt: Date;
}

export interface UpsertMetrcTransferInput {
  tenantId: string;
  manifestNumber: string;
  transferType: string;
  shipperName?: string | null;
  shipperLicense?: string | null;
  recipientName?: string | null;
  recipientLicense?: string | null;
  departedAt?: Date | null;
  receivedAt?: Date | null;
  packageCount?: number | null;
  rawPayload?: Record<string, unknown>;
}

function mapPackageRow(row: Record<string, unknown>): MetrcPackageRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    label: row.label as string,
    packageType: row.package_type as string,
    itemName: row.item_name as string | null,
    itemCategory: row.item_category as string | null,
    quantity: row.quantity as number,
    unitOfMeasure: row.unit_of_measure as string | null,
    isActive: row.is_active as boolean,
    packagedDate: row.packaged_date as Date | null,
    useByDate: row.use_by_date as Date | null,
    labTestingState: row.lab_testing_state as string | null,
    thcPercentage: row.thc_percentage as number | null,
    cbdPercentage: row.cbd_percentage as number | null,
    sourceHarvestName: row.source_harvest_name as string | null,
    licenseNumber: row.license_number as string | null,
    syncedAt: row.synced_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function upsertMetrcPackage(
  sql: SqlContext,
  input: UpsertMetrcPackageInput
): Promise<MetrcPackageRow> {
  const [row] = await sql`
    INSERT INTO metrc_packages (
      tenant_id, label, package_type, item_name, item_category,
      quantity, unit_of_measure, is_active, packaged_date, use_by_date,
      lab_testing_state, thc_percentage, cbd_percentage, source_harvest_name,
      license_number, raw_payload, synced_at
    ) VALUES (
      ${input.tenantId}, ${input.label}, ${input.packageType ?? 'Product'},
      ${input.itemName ?? null}, ${input.itemCategory ?? null},
      ${input.quantity}, ${input.unitOfMeasure ?? null}, ${input.isActive ?? true},
      ${input.packagedDate ? input.packagedDate.toISOString() : null},
      ${input.useByDate ? input.useByDate.toISOString() : null},
      ${input.labTestingState ?? null}, ${input.thcPercentage ?? null},
      ${input.cbdPercentage ?? null}, ${input.sourceHarvestName ?? null},
      ${input.licenseNumber ?? null},
      ${input.rawPayload ? JSON.stringify(input.rawPayload) : null},
      NOW()
    )
    ON CONFLICT (tenant_id, label) DO UPDATE SET
      quantity           = EXCLUDED.quantity,
      is_active          = EXCLUDED.is_active,
      lab_testing_state  = EXCLUDED.lab_testing_state,
      thc_percentage     = EXCLUDED.thc_percentage,
      cbd_percentage     = EXCLUDED.cbd_percentage,
      use_by_date        = EXCLUDED.use_by_date,
      raw_payload        = EXCLUDED.raw_payload,
      synced_at          = NOW()
    RETURNING *
  `;
  return mapPackageRow(row);
}

export async function listActiveMetrcPackages(
  sql: SqlContext,
  options: { itemCategory?: string; limit?: number; offset?: number } = {}
): Promise<MetrcPackageRow[]> {
  const rows = await sql`
    SELECT * FROM metrc_packages
    WHERE is_active = TRUE
      ${options.itemCategory ? sql`AND item_category = ${options.itemCategory}` : sql``}
    ORDER BY packaged_date DESC NULLS LAST
    LIMIT ${options.limit ?? 200} OFFSET ${options.offset ?? 0}
  `;
  return rows.map(mapPackageRow);
}

export async function getMetrcPackageByLabel(
  sql: SqlContext,
  label: string
): Promise<MetrcPackageRow | null> {
  const rows = await sql`SELECT * FROM metrc_packages WHERE label = ${label}`;
  return rows.length > 0 ? mapPackageRow(rows[0]) : null;
}

export async function upsertMetrcTransfer(
  sql: SqlContext,
  input: UpsertMetrcTransferInput
): Promise<MetrcTransferRow> {
  const [row] = await sql`
    INSERT INTO metrc_transfers (
      tenant_id, manifest_number, transfer_type, shipper_name, shipper_license,
      recipient_name, recipient_license, departed_at, received_at, package_count,
      raw_payload, synced_at
    ) VALUES (
      ${input.tenantId}, ${input.manifestNumber}, ${input.transferType},
      ${input.shipperName ?? null}, ${input.shipperLicense ?? null},
      ${input.recipientName ?? null}, ${input.recipientLicense ?? null},
      ${input.departedAt ? input.departedAt.toISOString() : null},
      ${input.receivedAt ? input.receivedAt.toISOString() : null},
      ${input.packageCount ?? null},
      ${input.rawPayload ? JSON.stringify(input.rawPayload) : null},
      NOW()
    )
    ON CONFLICT (tenant_id, manifest_number) DO UPDATE SET
      transfer_type     = EXCLUDED.transfer_type,
      received_at       = EXCLUDED.received_at,
      package_count     = EXCLUDED.package_count,
      raw_payload       = EXCLUDED.raw_payload,
      synced_at         = NOW()
    RETURNING *
  `;
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    manifestNumber: row.manifest_number as string,
    transferType: row.transfer_type as string,
    shipperName: row.shipper_name as string | null,
    shipperLicense: row.shipper_license as string | null,
    recipientName: row.recipient_name as string | null,
    recipientLicense: row.recipient_license as string | null,
    departedAt: row.departed_at as Date | null,
    receivedAt: row.received_at as Date | null,
    packageCount: row.package_count as number | null,
    syncedAt: row.synced_at as Date,
  };
}
