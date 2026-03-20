/**
 * Sync orchestrator — runs a full or incremental sync for a tenant.
 *
 * Call `runFullSync` on initial onboarding.
 * Call `runIncrementalSync` on a schedule (e.g. every 15 minutes).
 */

import { queryTenant } from '../db/client';
import { listSyncJobs } from '../data/repositories/sync';
import { listProducts } from '../data/repositories/products';
import { listCustomers as listCustomerRows } from '../data/repositories/customers';
import {
  syncProducts, syncInventory, syncSales, syncCustomers,
  syncMetrcPackages, syncMetrcTransfers,
  type SyncResult,
} from './pipeline';
import type { IPosAdapter } from '../pos/adapter';
import type { IMetrcAdapter } from '../metrc/adapter';

export interface FullSyncReport {
  tenantId: string;
  startedAt: Date;
  finishedAt: Date;
  results: SyncResult[];
  errors: string[];
}

/**
 * Full sync: pulls all entities in dependency order.
 * Products must come before inventory (inventory references product IDs).
 * Customers must come before sales (sales reference customer IDs).
 */
export async function runFullSync(
  tenantId: string,
  posAdapter: IPosAdapter,
  metrcAdapter?: IMetrcAdapter,
  opts: { pageSize?: number } = {}
): Promise<FullSyncReport> {
  const startedAt = new Date();
  const results: SyncResult[] = [];
  const errors: string[] = [];

  // 1. Products (must be first — inventory depends on product IDs)
  const productsResult = await syncProducts(tenantId, posAdapter, opts);
  results.push(productsResult);
  if (productsResult.error) errors.push(`products: ${productsResult.error}`);

  // Build product ID map: externalId → internal UUID
  const productIdMap = await buildProductIdMap(tenantId, posAdapter.posType);

  // 2. Inventory
  const inventoryResult = await syncInventory(tenantId, posAdapter, productIdMap, opts);
  results.push(inventoryResult);
  if (inventoryResult.error) errors.push(`inventory: ${inventoryResult.error}`);

  // 3. Customers (must come before sales)
  const customersResult = await syncCustomers(tenantId, posAdapter, opts);
  results.push(customersResult);
  if (customersResult.error) errors.push(`customers: ${customersResult.error}`);

  // Build customer ID map
  const customerIdMap = await buildCustomerIdMap(tenantId, posAdapter.posType);

  // 4. Sales
  const salesResult = await syncSales(tenantId, posAdapter, customerIdMap, productIdMap, opts);
  results.push(salesResult);
  if (salesResult.error) errors.push(`sales: ${salesResult.error}`);

  // 5. METRC (if adapter provided)
  if (metrcAdapter) {
    const packagesResult = await syncMetrcPackages(tenantId, metrcAdapter, opts);
    results.push(packagesResult);
    if (packagesResult.error) errors.push(`metrc_packages: ${packagesResult.error}`);

    const transfersResult = await syncMetrcTransfers(tenantId, metrcAdapter, opts);
    results.push(transfersResult);
    if (transfersResult.error) errors.push(`metrc_transfers: ${transfersResult.error}`);
  }

  return { tenantId, startedAt, finishedAt: new Date(), results, errors };
}

/**
 * Incremental sync: only pulls records changed since the last successful sync.
 */
export async function runIncrementalSync(
  tenantId: string,
  posAdapter: IPosAdapter,
  metrcAdapter?: IMetrcAdapter,
  opts: { pageSize?: number } = {}
): Promise<FullSyncReport> {
  const startedAt = new Date();
  const results: SyncResult[] = [];
  const errors: string[] = [];

  // Determine last sync timestamps
  const syncJobs = await queryTenant(tenantId, (sql) => listSyncJobs(sql));
  const lastSync = (entityType: string, source: string): Date | undefined => {
    const job = syncJobs.find(
      (j) => j.entityType === entityType && j.source === source && j.status === 'success'
    );
    return job?.lastSyncedAt ?? undefined;
  };

  const productIdMap = await buildProductIdMap(tenantId, posAdapter.posType);
  const customerIdMap = await buildCustomerIdMap(tenantId, posAdapter.posType);

  // Products (POS adapters typically don't have a "since" filter, so always full)
  const productsResult = await syncProducts(tenantId, posAdapter, opts);
  results.push(productsResult);
  if (productsResult.error) errors.push(`products: ${productsResult.error}`);

  // Inventory
  const inventoryResult = await syncInventory(tenantId, posAdapter, productIdMap, opts);
  results.push(inventoryResult);
  if (inventoryResult.error) errors.push(`inventory: ${inventoryResult.error}`);

  // Sales (incremental by date)
  const since = lastSync('sales', posAdapter.posType);
  const salesResult = await syncSales(
    tenantId, posAdapter, customerIdMap, productIdMap,
    { ...opts, since }
  );
  results.push(salesResult);
  if (salesResult.error) errors.push(`sales: ${salesResult.error}`);

  // METRC incremental
  if (metrcAdapter) {
    const pkgSince = lastSync('packages', 'metrc');
    const packagesResult = await syncMetrcPackages(tenantId, metrcAdapter, { ...opts, since: pkgSince });
    results.push(packagesResult);
    if (packagesResult.error) errors.push(`metrc_packages: ${packagesResult.error}`);

    const txSince = lastSync('transfers', 'metrc');
    const transfersResult = await syncMetrcTransfers(tenantId, metrcAdapter, { ...opts, since: txSince });
    results.push(transfersResult);
    if (transfersResult.error) errors.push(`metrc_transfers: ${transfersResult.error}`);
  }

  return { tenantId, startedAt, finishedAt: new Date(), results, errors };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildProductIdMap(
  tenantId: string,
  posType: string
): Promise<Map<string, string>> {
  const products = await queryTenant(tenantId, (sql) =>
    listProducts(sql, { limit: 10000 })
  );
  const map = new Map<string, string>();
  for (const p of products) {
    if (p.posType === posType) map.set(p.externalId, p.id);
  }
  return map;
}

async function buildCustomerIdMap(
  tenantId: string,
  posType: string
): Promise<Map<string, string>> {
  const customers = await queryTenant(tenantId, (sql) =>
    listCustomerRows(sql, { limit: 100000 })
  );
  const map = new Map<string, string>();
  for (const c of customers) {
    if (c.posType === posType) map.set(c.externalId, c.id);
  }
  return map;
}
