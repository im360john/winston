/**
 * Treez POS adapter.
 *
 * Implements IPosAdapter using the Treez v2 REST API.
 * Authenticates via API key stored in Winston's SecretsManager.
 *
 * Usage:
 *   const adapter = new TreezAdapter({
 *     baseUrl: 'https://pos.treez.io/api/v2',
 *     apiKey: secretsManager.get(tenantId, 'treez_api_key')!,
 *     dispensaryId: 'my-dispensary',
 *   });
 *   await adapter.connect();
 *   const products = await adapter.getProducts({ isActive: true });
 */

import { BasePosAdapter } from '../adapter';
import {
  ProductFilter,
  InventoryFilter,
  SaleFilter,
  CustomerFilter,
  Page,
} from '../adapter';
import {
  Product,
  InventoryRecord,
  SaleTransaction,
  Customer,
  PosAdapterError,
} from '../../types/pos';
import { TreezClient, TreezClientConfig } from './client';
import {
  normalizeProduct,
  normalizeInventory,
  normalizeSale,
  normalizeCustomer,
} from './normalizers';

// Default page size for Treez requests
const DEFAULT_PAGE_SIZE = 50;

/**
 * Treez API list response envelope.
 * Treez wraps paginated results in { data: [...], total: N }.
 */
interface TreezListResponse {
  data?: unknown[];
  items?: unknown[];
  total?: number;
  count?: number;
}

export class TreezAdapter extends BasePosAdapter {
  readonly posType = 'treez';

  private readonly client: TreezClient;
  private readonly tenantId: string;

  constructor(config: TreezClientConfig & { tenantId: string }) {
    super();
    this.tenantId = config.tenantId;
    this.client = new TreezClient(config);
  }

  /**
   * Verify that the Treez API is reachable and credentials are valid by
   * fetching a minimal product list (page 1, size 1).
   */
  async connect(): Promise<void> {
    try {
      await this.client.getProducts({ page: 1, page_size: 1 });
      this._connected = true;
    } catch (err) {
      this._connected = false;
      if (err instanceof PosAdapterError) throw err;
      throw new PosAdapterError(
        `Treez connection failed: ${(err as Error).message}`,
        'NETWORK',
        true,
        err,
      );
    }
  }

  // ---- Products -----------------------------------------------------------

  async getProducts(filter: ProductFilter = {}): Promise<Page<Product>> {
    this.assertConnected();
    const params = buildProductParams(filter);
    const raw = await this.client.getProducts(params) as TreezListResponse;
    const items = extractItems(raw);
    return buildPage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.map(r => normalizeProduct(r as Record<string, any>, this.tenantId)),
      raw,
      filter,
    );
  }

  // ---- Inventory ----------------------------------------------------------

  async getInventory(filter: InventoryFilter = {}): Promise<Page<InventoryRecord>> {
    this.assertConnected();
    const params = buildInventoryParams(filter);
    const raw = await this.client.getInventory(params) as TreezListResponse;
    const items = extractItems(raw);
    return buildPage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.map(r => normalizeInventory(r as Record<string, any>, this.tenantId)),
      raw,
      filter,
    );
  }

  // ---- Sales --------------------------------------------------------------

  async getSales(filter: SaleFilter = {}): Promise<Page<SaleTransaction>> {
    this.assertConnected();
    const params = buildSaleParams(filter);
    const raw = await this.client.getOrders(params) as TreezListResponse;
    const items = extractItems(raw);
    return buildPage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.map(r => normalizeSale(r as Record<string, any>, this.tenantId)),
      raw,
      filter,
    );
  }

  // ---- Customers ----------------------------------------------------------

  async getCustomers(filter: CustomerFilter = {}): Promise<Page<Customer>> {
    this.assertConnected();
    const params = buildCustomerParams(filter);
    const raw = await this.client.getCustomers(params) as TreezListResponse;
    const items = extractItems(raw);
    return buildPage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.map(r => normalizeCustomer(r as Record<string, any>, this.tenantId)),
      raw,
      filter,
    );
  }

  // ---- Private -----------------------------------------------------------

  private assertConnected(): void {
    if (!this._connected) {
      throw new PosAdapterError(
        'TreezAdapter.connect() must be called before querying data',
        'UNKNOWN',
        false,
      );
    }
  }
}

// ---- Param builders (isolate Treez field names) ---------------------------

function buildProductParams(
  f: ProductFilter,
): Record<string, string | number | boolean | undefined> {
  return {
    page: f.page ?? 1,
    page_size: f.pageSize ?? DEFAULT_PAGE_SIZE,
    ...(f.isActive !== undefined ? { is_active: f.isActive } : {}),
    ...(f.category ? { product_type: f.category } : {}),
    ...(f.search ? { search: f.search } : {}),
  };
}

function buildInventoryParams(
  f: InventoryFilter,
): Record<string, string | number | boolean | undefined> {
  return {
    page: f.page ?? 1,
    page_size: f.pageSize ?? DEFAULT_PAGE_SIZE,
    ...(f.locationId ? { room_id: f.locationId } : {}),
    ...(f.productId ? { product_id: f.productId } : {}),
    ...(f.lowStockOnly ? { low_stock: true } : {}),
  };
}

function buildSaleParams(
  f: SaleFilter,
): Record<string, string | number | boolean | undefined> {
  return {
    page: f.page ?? 1,
    page_size: f.pageSize ?? DEFAULT_PAGE_SIZE,
    ...(f.startDate ? { start_date: f.startDate } : {}),
    ...(f.endDate ? { end_date: f.endDate } : {}),
    ...(f.customerId ? { customer_id: f.customerId } : {}),
    ...(f.staffId ? { staff_id: f.staffId } : {}),
  };
}

function buildCustomerParams(
  f: CustomerFilter,
): Record<string, string | number | boolean | undefined> {
  return {
    page: f.page ?? 1,
    page_size: f.pageSize ?? DEFAULT_PAGE_SIZE,
    ...(f.search ? { search: f.search } : {}),
    ...(f.isActive !== undefined ? { is_active: f.isActive } : {}),
  };
}

// ---- Response helpers ----------------------------------------------------

function extractItems(raw: TreezListResponse): unknown[] {
  return raw.data ?? raw.items ?? [];
}

function buildPage<T>(
  items: T[],
  raw: TreezListResponse,
  filter: { page?: number; pageSize?: number },
): Page<T> {
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? DEFAULT_PAGE_SIZE;
  const total = raw.total ?? raw.count ?? items.length;
  return {
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}
