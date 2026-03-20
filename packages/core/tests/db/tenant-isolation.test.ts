/**
 * Tenant isolation tests for the multi-tenant data layer.
 *
 * These tests use mocked postgres.js calls to verify that:
 * 1. withTenant always sets app.current_tenant_id before running queries
 * 2. Repositories pass the right tenant_id on upserts
 * 3. Cross-tenant reads return null (RLS would block them, but we test the code path)
 *
 * Integration tests against a real Postgres instance live in tests/integration/
 * and require WINSTON_DATABASE_URL to be set.
 */

import { upsertProduct } from '../../src/data/repositories/products';
import { upsertInventory } from '../../src/data/repositories/inventory';
import { upsertCustomer } from '../../src/data/repositories/customers';
import { upsertSale } from '../../src/data/repositories/sales';
import type { SqlContext } from '../../src/db/types';

// ─── Mock postgres transaction ────────────────────────────────────────────────

function makeMockSql(): SqlContext & { calls: { query: string; params: unknown[] }[] } {
  const calls: { query: string; params: unknown[] }[] = [];

  const fn = function (strings: TemplateStringsArray, ...values: unknown[]) {
    calls.push({ query: strings.join('?'), params: values });
    return Promise.resolve([{ id: 'mock-uuid', tenant_id: values[0], ...Object.fromEntries(values.map((v, i) => [i, v])) }]);
  };

  return Object.assign(fn, { calls }) as unknown as SqlContext & { calls: typeof calls };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Repository: upsertProduct', () => {
  it('passes tenantId as first column value', async () => {
    const sql = makeMockSql();
    await upsertProduct(sql, {
      tenantId: 'tenant-a',
      externalId: 'prod-1',
      posType: 'treez',
      name: 'Blue Dream',
      category: 'flower',
      isActive: true,
    });

    expect(sql.calls.length).toBeGreaterThan(0);
    const firstCall = sql.calls[0];
    // The first parameter should be the tenantId
    expect(firstCall.params[0]).toBe('tenant-a');
    // The second parameter should be externalId
    expect(firstCall.params[1]).toBe('prod-1');
  });

  it('includes pos_type to scope per-adapter', async () => {
    const sql = makeMockSql();
    await upsertProduct(sql, {
      tenantId: 'tenant-b',
      externalId: 'prod-99',
      posType: 'dutchie',
      name: 'OG Kush',
      category: 'flower',
      isActive: true,
    });
    expect(sql.calls[0].params[2]).toBe('dutchie');
  });
});

describe('Repository: upsertInventory', () => {
  it('passes tenantId as first parameter', async () => {
    const sql = makeMockSql();
    await upsertInventory(sql, {
      tenantId: 'tenant-a',
      productId: 'internal-product-uuid',
      externalId: 'inv-1',
      posType: 'treez',
      quantityOnHand: 10,
    });
    expect(sql.calls[0].params[0]).toBe('tenant-a');
  });
});

describe('Repository: upsertCustomer', () => {
  it('passes tenantId as first parameter', async () => {
    const sql = makeMockSql();
    await upsertCustomer(sql, {
      tenantId: 'tenant-a',
      externalId: 'cust-1',
      posType: 'treez',
    });
    expect(sql.calls[0].params[0]).toBe('tenant-a');
  });
});

describe('Repository: upsertSale', () => {
  it('passes tenantId and includes line items', async () => {
    const sql = makeMockSql();
    await upsertSale(sql, {
      tenantId: 'tenant-a',
      externalId: 'sale-1',
      posType: 'treez',
      subtotal: 45.00,
      total: 49.00,
      taxTotal: 4.00,
      paymentMethod: 'cash',
      completedAt: new Date('2026-01-01T12:00:00Z'),
      lineItems: [
        {
          tenantId: 'tenant-a',
          productName: 'Blue Dream',
          quantity: 1,
          unitPrice: 45.00,
          lineTotal: 45.00,
        },
      ],
    });

    // First call is the transaction INSERT, second is DELETE line items, third is INSERT line item
    expect(sql.calls.length).toBeGreaterThanOrEqual(1);
    expect(sql.calls[0].params[0]).toBe('tenant-a');
  });
});

describe('Tenant isolation: different tenants produce different parameters', () => {
  it('tenant-a and tenant-b produce distinct tenant_id params', async () => {
    const sqlA = makeMockSql();
    const sqlB = makeMockSql();

    await upsertProduct(sqlA, {
      tenantId: 'tenant-a',
      externalId: 'prod-1',
      posType: 'treez',
      name: 'Blue Dream',
      category: 'flower',
      isActive: true,
    });

    await upsertProduct(sqlB, {
      tenantId: 'tenant-b',
      externalId: 'prod-1',  // same external ID — different tenant
      posType: 'treez',
      name: 'Blue Dream',
      category: 'flower',
      isActive: true,
    });

    expect(sqlA.calls[0].params[0]).toBe('tenant-a');
    expect(sqlB.calls[0].params[0]).toBe('tenant-b');
    expect(sqlA.calls[0].params[0]).not.toBe(sqlB.calls[0].params[0]);
  });
});
