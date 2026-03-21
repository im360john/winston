import { BlazeAdapter } from '../../src/pos/blaze/adapter';
import { BlazeClient } from '../../src/pos/blaze/client';
import { PosAdapterError } from '../../src/types/pos';

jest.mock('../../src/pos/blaze/client');

const MockedClient = BlazeClient as jest.MockedClass<typeof BlazeClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

const BASE_CONFIG = {
  tenantId: 'tenant-test',
  baseUrl: 'https://api.blaze.me/v1',
  apiKey: 'blaze-api-key',
};

function makeAdapter() {
  MockedClient.mockClear();
  return new BlazeAdapter(BASE_CONFIG);
}

describe('BlazeAdapter.connect()', () => {
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

describe('BlazeAdapter.getProducts()', () => {
  test('returns normalised product page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts
      .mockResolvedValueOnce({ data: [], total: 0 })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'prod-1',
            sku: 'SKU-001',
            name: 'Blue Dream',
            brand: 'Good Farms',
            category: 'flower',
            price_retail: '41.50',
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
    expect(page.items[0].priceRetail).toBe(41.5);
    expect(page.hasMore).toBe(false);
  });

  test('throws if not connected', async () => {
    const adapter = makeAdapter();
    await expect(adapter.getProducts()).rejects.toThrow(PosAdapterError);
  });
});

describe('BlazeAdapter.getInventory()', () => {
  test('returns normalised inventory page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts.mockResolvedValueOnce({ data: [], total: 0 });
    MockedClient.prototype.getInventory.mockResolvedValueOnce({
      data: [
        {
          id: 'inv-1',
          product_id: 'prod-1',
          location_id: 'vault',
          location_name: 'Main Vault',
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
    expect(page.items[0].locationName).toBe('Main Vault');
  });
});

describe('BlazeAdapter.getSales()', () => {
  test('returns normalised sales page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts.mockResolvedValueOnce({ data: [], total: 0 });
    MockedClient.prototype.getSales.mockResolvedValueOnce({
      data: [
        {
          id: 'sale-1',
          status: 'completed',
          payment_method: 'cash',
          total: '62.00',
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
    expect(page.items[0].paymentMethod).toBe('cash');
    expect(page.items[0].total).toBe(62);
  });
});

describe('BlazeAdapter.getCustomers()', () => {
  test('returns normalised customer page', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getProducts.mockResolvedValueOnce({ data: [], total: 0 });
    MockedClient.prototype.getCustomers.mockResolvedValueOnce({
      data: [
        {
          id: 'cust-1',
          external_id: 'C-001',
          first_name: 'Jane',
          last_name: 'Doe',
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
    expect(page.items[0].firstName).toBe('Jane');
    expect(page.items[0].customerType).toBe('recreational');
  });
});

describe('adapterRegistry', () => {
  test('blaze is registered', () => {
    const { adapterRegistry } = require('../../src/pos/index');
    expect(adapterRegistry.list()).toContain('blaze');
  });
});
