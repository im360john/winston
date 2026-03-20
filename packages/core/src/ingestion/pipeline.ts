/**
 * Winston Ingestion Pipeline
 *
 * Pulls data from a POS adapter and/or METRC, normalizes it, and upserts
 * into the tenant-isolated data layer.
 */

import { withTenant } from '../db/client';
import { upsertProduct } from '../data/repositories/products';
import { upsertInventory } from '../data/repositories/inventory';
import { upsertSale } from '../data/repositories/sales';
import { upsertCustomer } from '../data/repositories/customers';
import { upsertMetrcPackage, upsertMetrcTransfer } from '../data/repositories/metrc';
import {
  markSyncStarted, markSyncSuccess, markSyncFailed,
} from '../data/repositories/sync';
import type { IPosAdapter } from '../pos/adapter';
import type { IMetrcAdapter } from '../metrc/adapter';
import type {
  Product, InventoryRecord, SaleTransaction, Customer,
} from '../types/pos';

export interface SyncOptions {
  maxPages?: number;
  pageSize?: number;
}

export interface SyncResult {
  entityType: string;
  recordsSynced: number;
  durationMs: number;
  error?: string;
}

// ─── POS Sync ─────────────────────────────────────────────────────────────────

export async function syncProducts(
  tenantId: string,
  posAdapter: IPosAdapter,
  opts: SyncOptions = {}
): Promise<SyncResult> {
  const start = Date.now();
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? Infinity;
  let recordsSynced = 0;

  await withTenant(tenantId, (sql) => markSyncStarted(sql, tenantId, posAdapter.posType, 'products'));

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const result = await posAdapter.getProducts({ page, pageSize });

      await withTenant(tenantId, async (sql) => {
        for (const product of result.items as Product[]) {
          await upsertProduct(sql, {
            tenantId,
            externalId: product.id,
            posType: posAdapter.posType,
            name: product.name,
            brand: product.brand || null,
            category: product.category,
            subcategory: product.subcategory || null,
            sku: product.sku || null,
            priceRetail: product.priceRetail,
            thcPercentage: product.thcPct ?? null,
            cbdPercentage: product.cbdPct ?? null,
            weightGrams: product.weightGrams ?? null,
            unitOfMeasure: product.unitOfMeasure,
            metrcTag: product.metrcTag ?? null,
            isActive: product.isActive,
            rawPayload: product._raw as Record<string, unknown> | undefined,
          });
        }
      });

      recordsSynced += result.items.length;
      hasMore = result.hasMore;
      page++;
    }

    await withTenant(tenantId, (sql) =>
      markSyncSuccess(sql, tenantId, posAdapter.posType, 'products', recordsSynced)
    );

    return { entityType: 'products', recordsSynced, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await withTenant(tenantId, (sql) =>
      markSyncFailed(sql, tenantId, posAdapter.posType, 'products', msg)
    ).catch(() => {});
    return { entityType: 'products', recordsSynced, durationMs: Date.now() - start, error: msg };
  }
}

export async function syncInventory(
  tenantId: string,
  posAdapter: IPosAdapter,
  productIdMap: Map<string, string>,
  opts: SyncOptions = {}
): Promise<SyncResult> {
  const start = Date.now();
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? Infinity;
  let recordsSynced = 0;

  await withTenant(tenantId, (sql) => markSyncStarted(sql, tenantId, posAdapter.posType, 'inventory'));

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const result = await posAdapter.getInventory({ page, pageSize });

      await withTenant(tenantId, async (sql) => {
        for (const inv of result.items as InventoryRecord[]) {
          const internalProductId = productIdMap.get(inv.productId);
          if (!internalProductId) continue;

          await upsertInventory(sql, {
            tenantId,
            productId: internalProductId,
            externalId: inv.id,
            posType: posAdapter.posType,
            locationId: inv.locationId,
            locationName: inv.locationName,
            quantityOnHand: inv.quantityOnHand,
            quantityReserved: inv.quantityReserved,
            reorderPoint: inv.reorderPoint,
            unitCost: inv.unitCost ?? null,
            rawPayload: inv._raw as Record<string, unknown> | undefined,
          });
        }
      });

      recordsSynced += result.items.length;
      hasMore = result.hasMore;
      page++;
    }

    await withTenant(tenantId, (sql) =>
      markSyncSuccess(sql, tenantId, posAdapter.posType, 'inventory', recordsSynced)
    );

    return { entityType: 'inventory', recordsSynced, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await withTenant(tenantId, (sql) =>
      markSyncFailed(sql, tenantId, posAdapter.posType, 'inventory', msg)
    ).catch(() => {});
    return { entityType: 'inventory', recordsSynced, durationMs: Date.now() - start, error: msg };
  }
}

export async function syncSales(
  tenantId: string,
  posAdapter: IPosAdapter,
  customerIdMap: Map<string, string>,
  productIdMap: Map<string, string>,
  opts: SyncOptions & { since?: Date } = {}
): Promise<SyncResult> {
  const start = Date.now();
  const pageSize = opts.pageSize ?? 50;
  const maxPages = opts.maxPages ?? Infinity;
  let recordsSynced = 0;

  await withTenant(tenantId, (sql) => markSyncStarted(sql, tenantId, posAdapter.posType, 'sales'));

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const result = await posAdapter.getSales({
        page,
        pageSize,
        ...(opts.since ? { startDate: opts.since.toISOString() } : {}),
      });

      await withTenant(tenantId, async (sql) => {
        for (const sale of result.items as SaleTransaction[]) {
          await upsertSale(sql, {
            tenantId,
            externalId: sale.id,
            posType: posAdapter.posType,
            customerId: sale.customerId ? customerIdMap.get(sale.customerId) ?? null : null,
            employeeId: sale.staffId ?? null,
            registerId: sale.registerId ?? null,
            subtotal: sale.subtotal,
            discountTotal: sale.discountTotal,
            taxTotal: sale.taxTotal,
            total: sale.total,
            paymentMethod: sale.paymentMethod,
            status: sale.status,
            completedAt: new Date(sale.completedAt),
            rawPayload: sale._raw as Record<string, unknown> | undefined,
            lineItems: (sale.lineItems || []).map((li) => ({
              tenantId,
              productId: productIdMap.get(li.productId) ?? null,
              externalId: li.productId,
              productName: li.productName,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              discount: li.discount,
              tax: li.tax,
              lineTotal: li.lineTotal,
              metrcTag: li.metrcTag ?? null,
            })),
          });
        }
      });

      recordsSynced += result.items.length;
      hasMore = result.hasMore;
      page++;
    }

    await withTenant(tenantId, (sql) =>
      markSyncSuccess(sql, tenantId, posAdapter.posType, 'sales', recordsSynced)
    );

    return { entityType: 'sales', recordsSynced, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await withTenant(tenantId, (sql) =>
      markSyncFailed(sql, tenantId, posAdapter.posType, 'sales', msg)
    ).catch(() => {});
    return { entityType: 'sales', recordsSynced, durationMs: Date.now() - start, error: msg };
  }
}

export async function syncCustomers(
  tenantId: string,
  posAdapter: IPosAdapter,
  opts: SyncOptions = {}
): Promise<SyncResult> {
  const start = Date.now();
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? Infinity;
  let recordsSynced = 0;

  await withTenant(tenantId, (sql) => markSyncStarted(sql, tenantId, posAdapter.posType, 'customers'));

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const result = await posAdapter.getCustomers({ page, pageSize });

      await withTenant(tenantId, async (sql) => {
        for (const cust of result.items as Customer[]) {
          await upsertCustomer(sql, {
            tenantId,
            externalId: cust.externalId,
            posType: posAdapter.posType,
            firstName: cust.firstName || null,
            lastName: cust.lastName || null,
            email: cust.email ?? null,
            phone: cust.phone ?? null,
            customerType: cust.customerType,
            loyaltyPoints: cust.loyaltyPoints ?? 0,
            totalSpend: cust.totalSpend ?? 0,
            visitCount: cust.visitCount ?? 0,
            lastVisitAt: cust.lastVisitAt ? new Date(cust.lastVisitAt) : null,
            rawPayload: cust._raw as Record<string, unknown> | undefined,
          });
        }
      });

      recordsSynced += result.items.length;
      hasMore = result.hasMore;
      page++;
    }

    await withTenant(tenantId, (sql) =>
      markSyncSuccess(sql, tenantId, posAdapter.posType, 'customers', recordsSynced)
    );

    return { entityType: 'customers', recordsSynced, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await withTenant(tenantId, (sql) =>
      markSyncFailed(sql, tenantId, posAdapter.posType, 'customers', msg)
    ).catch(() => {});
    return { entityType: 'customers', recordsSynced, durationMs: Date.now() - start, error: msg };
  }
}

// ─── METRC Sync ───────────────────────────────────────────────────────────────

export async function syncMetrcPackages(
  tenantId: string,
  metrcAdapter: IMetrcAdapter,
  opts: SyncOptions & { since?: Date } = {}
): Promise<SyncResult> {
  const start = Date.now();
  const pageSize = opts.pageSize ?? 250;
  const maxPages = opts.maxPages ?? Infinity;
  let recordsSynced = 0;

  await withTenant(tenantId, (sql) => markSyncStarted(sql, tenantId, 'metrc', 'packages'));

  try {
    let skip = 0;
    let hasMore = true;

    while (hasMore && skip / pageSize < maxPages) {
      const page = await metrcAdapter.getActivePackages({
        skip,
        take: pageSize,
        lastModifiedStart: opts.since?.toISOString(),
      });

      await withTenant(tenantId, async (sql) => {
        for (const pkg of page.items) {
          await upsertMetrcPackage(sql, {
            tenantId,
            label: pkg.Label,
            quantity: pkg.Quantity,
            unitOfMeasure: pkg.UnitOfMeasureName,
            isActive: true,
            packagedDate: pkg.PackagedDate ? new Date(pkg.PackagedDate) : null,
            rawPayload: pkg as unknown as Record<string, unknown>,
          });
        }
      });

      recordsSynced += page.items.length;
      hasMore = page.hasMore;
      skip += pageSize;
    }

    await withTenant(tenantId, (sql) =>
      markSyncSuccess(sql, tenantId, 'metrc', 'packages', recordsSynced)
    );

    return { entityType: 'metrc_packages', recordsSynced, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await withTenant(tenantId, (sql) =>
      markSyncFailed(sql, tenantId, 'metrc', 'packages', msg)
    ).catch(() => {});
    return { entityType: 'metrc_packages', recordsSynced, durationMs: Date.now() - start, error: msg };
  }
}

export async function syncMetrcTransfers(
  tenantId: string,
  metrcAdapter: IMetrcAdapter,
  opts: SyncOptions & { since?: Date } = {}
): Promise<SyncResult> {
  const start = Date.now();
  const pageSize = opts.pageSize ?? 250;
  const maxPages = opts.maxPages ?? Infinity;
  let recordsSynced = 0;

  await withTenant(tenantId, (sql) => markSyncStarted(sql, tenantId, 'metrc', 'transfers'));

  try {
    let skip = 0;
    let hasMore = true;

    while (hasMore && skip / pageSize < maxPages) {
      const page = await metrcAdapter.getIncomingTransfers({
        skip,
        take: pageSize,
        lastModifiedStart: opts.since?.toISOString(),
      });

      await withTenant(tenantId, async (sql) => {
        for (const t of page.items) {
          await upsertMetrcTransfer(sql, {
            tenantId,
            manifestNumber: t.ManifestNumber,
            transferType: 'incoming',
            shipperName: t.ShipperFacilityName,
            shipperLicense: t.ShipperFacilityLicenseNumber,
            departedAt: t.ActualDepartureDateTime ? new Date(t.ActualDepartureDateTime) : null,
            packageCount: t.PackageCount,
            rawPayload: t as unknown as Record<string, unknown>,
          });
        }
      });

      recordsSynced += page.items.length;
      hasMore = page.hasMore;
      skip += pageSize;
    }

    await withTenant(tenantId, (sql) =>
      markSyncSuccess(sql, tenantId, 'metrc', 'transfers', recordsSynced)
    );

    return { entityType: 'metrc_transfers', recordsSynced, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await withTenant(tenantId, (sql) =>
      markSyncFailed(sql, tenantId, 'metrc', 'transfers', msg)
    ).catch(() => {});
    return { entityType: 'metrc_transfers', recordsSynced, durationMs: Date.now() - start, error: msg };
  }
}
