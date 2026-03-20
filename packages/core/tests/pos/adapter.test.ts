/**
 * TreezAdapter integration tests (no real network).
 *
 * The Treez HTTP client is mocked so we can test the full adapter pipeline:
 * connect → data fetch → normalisation → pagination envelope.
 */

import { TreezAdapter } from '../../src/pos/treez/adapter';
import { TreezClient } from '../../src/pos/treez/client';
import { PosAdapterError } from '../../src/types/pos';

jest.mock('../../src/pos/treez/client');

const MockedClient = TreezClient as jest.MockedClass<typeof TreezClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

const BASE_CONFIG = {
  tenantId: 'tenant-test',
  baseUrl: 'https://pos.treez.io/api/v2',
  apiKey: 'test-api-key',
  dispensaryId: 'test-dispensary',
};

function makeAdapter() {
  MockedClient.mockClear();
  return new TreezAdapter(BASE_CONFIG);
}

// ---- connect ---------------------------------------------------------------

describe('TreezAdapter.connect()', () => {
  test('marks adapter as connected on success', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts.mockResolvedValueOnce({ data: [], total: 0 });

    await adapter.connect();
    expect(adapter.isConnected).toBe(true);
  });

  test('marks adapter as disconnected and throws on failure', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts.mockRejectedValueOnce(
      new PosAdapterError('auth failed', 'AUTH', false),
    );

    await expect(adapter.connect()).rejects.toThrow(PosAdapterError);
    expect(adapter.isConnected).toBe(false);
  });
});

// ---- getProducts -----------------------------------------------------------

describe('TreezAdapter.getProducts()', () => {
  test('returns normalised product page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts
      .mockResolvedValueOnce({ data: [], total: 0 })   // connect call
      .mockResolvedValueOnce({
        data: [
          {
            product_id: 'p-1',
            sku: 'SKU-001',
            product_name: 'Blue Dream',
            brand: 'House Brand',
            product_type: 'flower',
            price_retail: '40.00',
            is_active: true,
          },
        ],
        total: 1,
      });

    await adapter.connect();
    const page = await adapter.getProducts({ page: 1, pageSize: 50 });

    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].name).toBe('Blue Dream');
    expect(page.items[0].category).toBe('flower');
    expect(page.items[0].priceRetail).toBe(40);
    expect(page.hasMore).toBe(false);
  });

  test('throws if not connected', async () => {
    const adapter = makeAdapter();
    await expect(adapter.getProducts()).rejects.toThrow(PosAdapterError);
  });

  test('passes filter params to client', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts
      .mockResolvedValueOnce({ data: [], total: 0 })
      .mockResolvedValueOnce({ data: [], total: 0 });

    await adapter.connect();
    await adapter.getProducts({ isActive: true, category: 'flower', page: 2, pageSize: 25 });

    // Second call (the data fetch) should include filter params
    const callArgs = MockedClient.prototype.getProducts.mock.calls[1][0];
    expect(callArgs).toMatchObject({ is_active: true, product_type: 'flower', page: 2, page_size: 25 });
  });

  test('hasMore is true when more pages exist', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts
      .mockResolvedValueOnce({ data: [], total: 0 })
      .mockResolvedValueOnce({ data: [{ product_id: 'p1' }], total: 200 });

    await adapter.connect();
    const page = await adapter.getProducts({ page: 1, pageSize: 50 });
    expect(page.hasMore).toBe(true);
  });
});

// ---- getInventory ----------------------------------------------------------

describe('TreezAdapter.getInventory()', () => {
  test('returns normalised inventory page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts.mockResolvedValueOnce({ data: [], total: 0 });
    MockedClient.prototype.getInventory.mockResolvedValueOnce({
      data: [
        {
          inventory_id: 'inv-1',
          product_id: 'p-1',
          room_id: 'rm-1',
          room_name: 'Floor',
          quantity_on_hand: '50',
          quantity_reserved: '5',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
    });

    await adapter.connect();
    const page = await adapter.getInventory();

    expect(page.items).toHaveLength(1);
    expect(page.items[0].quantityOnHand).toBe(50);
    expect(page.items[0].locationName).toBe('Floor');
  });
});

// ---- getSales --------------------------------------------------------------

describe('TreezAdapter.getSales()', () => {
  test('returns normalised sales page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts.mockResolvedValueOnce({ data: [], total: 0 });
    MockedClient.prototype.getOrders.mockResolvedValueOnce({
      data: [
        {
          order_id: 'ord-1',
          status: 'completed',
          payment_method: 'cash',
          total: '55.00',
          completed_at: '2026-02-01T12:00:00Z',
          line_items: [],
        },
      ],
      total: 1,
    });

    await adapter.connect();
    const page = await adapter.getSales();

    expect(page.items).toHaveLength(1);
    expect(page.items[0].status).toBe('completed');
    expect(page.items[0].total).toBe(55);
  });
});

// ---- getCustomers ----------------------------------------------------------

describe('TreezAdapter.getCustomers()', () => {
  test('returns normalised customer page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts.mockResolvedValueOnce({ data: [], total: 0 });
    MockedClient.prototype.getCustomers.mockResolvedValueOnce({
      data: [
        {
          customer_id: 'cust-1',
          first_name: 'Alice',
          last_name: 'Smith',
          customer_type: 'recreational',
          is_active: true,
          created_at: '2024-06-01T00:00:00Z',
        },
      ],
      total: 1,
    });

    await adapter.connect();
    const page = await adapter.getCustomers();

    expect(page.items).toHaveLength(1);
    expect(page.items[0].firstName).toBe('Alice');
    expect(page.items[0].customerType).toBe('recreational');
  });
});

// ---- Registry --------------------------------------------------------------

describe('adapterRegistry', () => {
  test('treez is registered', () => {
    const { adapterRegistry } = require('../../src/pos/index');
    expect(adapterRegistry.list()).toContain('treez');
  });
});
