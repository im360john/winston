/**
 * Winston Agent Query Interface
 *
 * High-level, tenant-scoped data access for agent skills and workflows.
 * Every method takes a tenantId and scopes all DB access automatically.
 *
 * This is the ONLY surface the agent runtime should use for data access.
 * Do not call repositories directly from skills — use this interface.
 */

import { queryTenant } from '../db/client';
import {
  listProducts, getProductByMetrcTag, getProductByExternalId,
  type ProductFilter, type ProductRow,
} from './repositories/products';
import {
  listInventory, getLowStockItems, getInventoryByProductId,
  type InventoryRow, type LowStockItem,
} from './repositories/inventory';
import {
  listSales, getSalesSummary, getTopSellingProducts, getLineItemsForSale,
  type SalesFilter, type SaleTransactionRow, type SalesSummary,
} from './repositories/sales';
import {
  listCustomers, getCustomerByExternalId, getTopCustomers, countCustomersByType,
  type CustomerFilter, type CustomerRow,
} from './repositories/customers';
import {
  listActiveMetrcPackages, getMetrcPackageByLabel,
  type MetrcPackageRow,
} from './repositories/metrc';
import {
  listSyncJobs,
  type SyncJobRow,
} from './repositories/sync';

// ─── Products ─────────────────────────────────────────────────────────────────

export async function queryProducts(
  tenantId: string,
  filter: ProductFilter = {}
): Promise<ProductRow[]> {
  return queryTenant(tenantId, (sql) => listProducts(sql, filter));
}

export async function queryProductByMetrcTag(
  tenantId: string,
  metrcTag: string
): Promise<ProductRow | null> {
  return queryTenant(tenantId, (sql) => getProductByMetrcTag(sql, metrcTag));
}

export async function queryProductByExternalId(
  tenantId: string,
  externalId: string,
  posType: string
): Promise<ProductRow | null> {
  return queryTenant(tenantId, (sql) => getProductByExternalId(sql, externalId, posType));
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function queryInventory(
  tenantId: string,
  options: { locationId?: string; lowStockOnly?: boolean; limit?: number } = {}
): Promise<InventoryRow[]> {
  return queryTenant(tenantId, (sql) => listInventory(sql, options));
}

export async function queryLowStock(tenantId: string): Promise<LowStockItem[]> {
  return queryTenant(tenantId, (sql) => getLowStockItems(sql));
}

export async function queryInventoryForProduct(
  tenantId: string,
  productId: string
): Promise<InventoryRow[]> {
  return queryTenant(tenantId, (sql) => getInventoryByProductId(sql, productId));
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export async function querySales(
  tenantId: string,
  filter: SalesFilter = {}
): Promise<SaleTransactionRow[]> {
  return queryTenant(tenantId, (sql) => listSales(sql, filter));
}

export async function querySalesSummary(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<SalesSummary> {
  return queryTenant(tenantId, (sql) => getSalesSummary(sql, startDate, endDate));
}

export async function queryTopProducts(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  limit = 10
): Promise<{ productId: string | null; productName: string; totalQty: number; totalRevenue: number }[]> {
  return queryTenant(tenantId, (sql) => getTopSellingProducts(sql, startDate, endDate, limit));
}

export async function querySaleLineItems(
  tenantId: string,
  transactionId: string
) {
  return queryTenant(tenantId, (sql) => getLineItemsForSale(sql, transactionId));
}

// ─── Customers ────────────────────────────────────────────────────────────────

export async function queryCustomers(
  tenantId: string,
  filter: CustomerFilter = {}
): Promise<CustomerRow[]> {
  return queryTenant(tenantId, (sql) => listCustomers(sql, filter));
}

export async function queryCustomerByExternalId(
  tenantId: string,
  externalId: string,
  posType: string
): Promise<CustomerRow | null> {
  return queryTenant(tenantId, (sql) => getCustomerByExternalId(sql, externalId, posType));
}

export async function queryTopCustomers(
  tenantId: string,
  limit = 20
): Promise<CustomerRow[]> {
  return queryTenant(tenantId, (sql) => getTopCustomers(sql, limit));
}

export async function queryCustomerSegments(
  tenantId: string
): Promise<Record<string, number>> {
  return queryTenant(tenantId, (sql) => countCustomersByType(sql));
}

// ─── METRC ────────────────────────────────────────────────────────────────────

export async function queryMetrcPackages(
  tenantId: string,
  options: { itemCategory?: string; limit?: number } = {}
): Promise<MetrcPackageRow[]> {
  return queryTenant(tenantId, (sql) => listActiveMetrcPackages(sql, options));
}

export async function queryMetrcPackageByLabel(
  tenantId: string,
  label: string
): Promise<MetrcPackageRow | null> {
  return queryTenant(tenantId, (sql) => getMetrcPackageByLabel(sql, label));
}

// ─── Sync status ──────────────────────────────────────────────────────────────

export async function querySyncStatus(tenantId: string): Promise<SyncJobRow[]> {
  return queryTenant(tenantId, (sql) => listSyncJobs(sql));
}

// ─── Composite queries (agent-friendly) ──────────────────────────────────────

/**
 * Returns a snapshot of the tenant's operational state for agent context.
 * Designed to be called at the start of a workflow to prime the agent.
 */
export async function queryOperationalSnapshot(tenantId: string): Promise<{
  lowStockCount: number;
  todaySalesSummary: SalesSummary;
  customerSegments: Record<string, number>;
  syncStatus: SyncJobRow[];
}> {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const [lowStock, todaySales, segments, syncStatus] = await Promise.all([
    queryLowStock(tenantId),
    querySalesSummary(tenantId, startOfDay, endOfDay),
    queryCustomerSegments(tenantId),
    querySyncStatus(tenantId),
  ]);

  return {
    lowStockCount: lowStock.length,
    todaySalesSummary: todaySales,
    customerSegments: segments,
    syncStatus,
  };
}
