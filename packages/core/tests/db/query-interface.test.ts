/**
 * Tests for the agent-facing query interface.
 * Verifies that query functions wire through to the correct repositories
 * and that queryOperationalSnapshot aggregates data correctly.
 */

jest.mock('../../src/db/client', () => ({
  queryTenant: jest.fn(async (tenantId: string, fn: (sql: unknown) => Promise<unknown>) => {
    // Return the result of fn with a mock sql object
    return fn(makeMockSql());
  }),
  withTenant: jest.fn(async (tenantId: string, fn: (sql: unknown) => Promise<unknown>) => {
    return fn(makeMockSql());
  }),
  getPool: jest.fn(),
  closePool: jest.fn(),
}));

// Mock all repositories
jest.mock('../../src/data/repositories/products', () => ({
  listProducts: jest.fn(async () => []),
  getProductByMetrcTag: jest.fn(async () => null),
  getProductByExternalId: jest.fn(async () => null),
}));

jest.mock('../../src/data/repositories/inventory', () => ({
  listInventory: jest.fn(async () => []),
  getLowStockItems: jest.fn(async () => [
    { productId: 'p1', productName: 'Blue Dream', category: 'flower', locationName: 'Floor', quantityAvailable: 2, reorderPoint: 5, reorderQuantity: 20 },
  ]),
  getInventoryByProductId: jest.fn(async () => []),
}));

jest.mock('../../src/data/repositories/sales', () => ({
  listSales: jest.fn(async () => []),
  getSalesSummary: jest.fn(async () => ({
    totalTransactions: 42,
    totalRevenue: 2100.00,
    totalTax: 210.00,
    totalDiscount: 50.00,
    averageBasket: 50.00,
    byPaymentMethod: { cash: { count: 30, revenue: 1500 }, debit: { count: 12, revenue: 600 } },
  })),
  getTopSellingProducts: jest.fn(async () => []),
  getLineItemsForSale: jest.fn(async () => []),
}));

jest.mock('../../src/data/repositories/customers', () => ({
  listCustomers: jest.fn(async () => []),
  getCustomerByExternalId: jest.fn(async () => null),
  getTopCustomers: jest.fn(async () => []),
  countCustomersByType: jest.fn(async () => ({ recreational: 200, medical: 45 })),
}));

jest.mock('../../src/data/repositories/metrc', () => ({
  listActiveMetrcPackages: jest.fn(async () => []),
  getMetrcPackageByLabel: jest.fn(async () => null),
  upsertMetrcPackage: jest.fn(async () => ({})),
  upsertMetrcTransfer: jest.fn(async () => ({})),
}));

jest.mock('../../src/data/repositories/sync', () => ({
  listSyncJobs: jest.fn(async () => []),
  markSyncStarted: jest.fn(async () => ({})),
  markSyncSuccess: jest.fn(async () => ({})),
  markSyncFailed: jest.fn(async () => ({})),
  getSyncJob: jest.fn(async () => null),
}));

function makeMockSql() {
  return new Proxy({}, { get: () => () => Promise.resolve([]) });
}

import {
  queryProducts,
  queryLowStock,
  querySalesSummary,
  queryCustomerSegments,
  queryOperationalSnapshot,
} from '../../src/data/query';
import { getLowStockItems } from '../../src/data/repositories/inventory';
import { getSalesSummary } from '../../src/data/repositories/sales';
import { countCustomersByType } from '../../src/data/repositories/customers';

const TENANT = 'test-tenant-id';

describe('queryProducts', () => {
  it('delegates to listProducts repository', async () => {
    const result = await queryProducts(TENANT, { category: 'flower' });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('queryLowStock', () => {
  it('returns low stock items', async () => {
    const result = await queryLowStock(TENANT);
    expect(result.length).toBe(1);
    expect(result[0].productName).toBe('Blue Dream');
  });
});

describe('querySalesSummary', () => {
  it('returns summary with payment breakdown', async () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-01-31');
    const summary = await querySalesSummary(TENANT, start, end);
    expect(summary.totalTransactions).toBe(42);
    expect(summary.totalRevenue).toBe(2100);
    expect(summary.byPaymentMethod.cash.count).toBe(30);
  });
});

describe('queryCustomerSegments', () => {
  it('returns customer type counts', async () => {
    const segments = await queryCustomerSegments(TENANT);
    expect(segments.recreational).toBe(200);
    expect(segments.medical).toBe(45);
  });
});

describe('queryOperationalSnapshot', () => {
  it('aggregates low stock, sales, segments, and sync status', async () => {
    const snapshot = await queryOperationalSnapshot(TENANT);
    expect(snapshot.lowStockCount).toBe(1);
    expect(snapshot.todaySalesSummary.totalRevenue).toBe(2100);
    expect(snapshot.customerSegments.recreational).toBe(200);
    expect(Array.isArray(snapshot.syncStatus)).toBe(true);
  });
});
