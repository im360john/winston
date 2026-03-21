import { DutchieAdapter } from '../../src/pos/dutchie/adapter';
import { DutchieClient } from '../../src/pos/dutchie/client';
import { PosAdapterError } from '../../src/types/pos';

jest.mock('../../src/pos/dutchie/client');

const MockedClient = DutchieClient as jest.MockedClass<typeof DutchieClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

const BASE_CONFIG = {
  tenantId: 'tenant-test',
  baseUrl: 'https://api.dutchie.com/v1',
  apiKey: 'dutchie-api-key',
  authMode: 'auto' as const,
  tokenUrl: 'https://auth.dutchie.com/oauth/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};

function makeAdapter() {
  MockedClient.mockClear();
  return new DutchieAdapter(BASE_CONFIG);
}

describe('DutchieAdapter.connect()', () => {
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

describe('DutchieAdapter.getProducts()', () => {
  test('returns normalised product page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts
      .mockResolvedValueOnce({ data: [], total: 0 })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'prod-1',
            sku: 'SKU-001',
            name: 'Sour Diesel',
            brand: 'Good Farms',
            category: 'flower',
            price_retail: '42.50',
            is_active: true,
          },
        ],
        total: 1,
      });

    await adapter.connect();
    const page = await adapter.getProducts({ page: 1, pageSize: 50 });

    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].name).toBe('Sour Diesel');
    expect(page.items[0].category).toBe('flower');
    expect(page.items[0].priceRetail).toBe(42.5);
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

    const callArgs = MockedClient.prototype.getProducts.mock.calls[1][0];
    expect(callArgs).toMatchObject({ is_active: true, category: 'flower', page: 2, page_size: 25 });
  });
});

describe('DutchieAdapter.getInventory()', () => {
  test('returns normalised inventory page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts.mockResolvedValueOnce({ data: [], total: 0 });
    MockedClient.prototype.getInventory.mockResolvedValueOnce({
      data: [
        {
          id: 'inv-1',
          product_id: 'prod-1',
          location_id: 'floor',
          location_name: 'Sales Floor',
          quantity_on_hand: '100',
          quantity_reserved: '7',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
    });

    await adapter.connect();
    const page = await adapter.getInventory();

    expect(page.items).toHaveLength(1);
    expect(page.items[0].quantityOnHand).toBe(100);
    expect(page.items[0].locationName).toBe('Sales Floor');
  });
});

describe('DutchieAdapter.getSales()', () => {
  test('returns normalised sales page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts.mockResolvedValueOnce({ data: [], total: 0 });
    MockedClient.prototype.getSales.mockResolvedValueOnce({
      data: [
        {
          id: 'sale-1',
          status: 'completed',
          payment_method: 'debit_card',
          total: '77.00',
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
    expect(page.items[0].paymentMethod).toBe('debit');
    expect(page.items[0].total).toBe(77);
  });
});

describe('DutchieAdapter.getCustomers()', () => {
  test('returns normalised customer page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts.mockResolvedValueOnce({ data: [], total: 0 });
    MockedClient.prototype.getCustomers.mockResolvedValueOnce({
      data: [
        {
          id: 'cust-1',
          external_id: 'C-001',
          first_name: 'Alice',
          last_name: 'Smith',
          customer_type: 'medical',
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
    expect(page.items[0].customerType).toBe('medical');
  });
});

describe('adapterRegistry', () => {
  test('dutchie is registered', () => {
    const { adapterRegistry } = require('../../src/pos/index');
    expect(adapterRegistry.list()).toContain('dutchie');
  });
});
