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
import { BlazeClient, BlazeClientConfig } from './client';
import {
  normalizeProduct,
  normalizeInventory,
  normalizeSale,
  normalizeCustomer,
} from './normalizers';

const DEFAULT_PAGE_SIZE = 50;

interface BlazeListResponse {
  data?: unknown[];
  items?: unknown[];
  total?: number;
  count?: number;
  pagination?: {
    total?: number;
  };
}

export class BlazeAdapter extends BasePosAdapter {
  readonly posType = 'blaze';

  private readonly client: BlazeClient;
  private readonly tenantId: string;

  constructor(config: BlazeClientConfig & { tenantId: string }) {
    super();
    this.tenantId = config.tenantId;
    this.client = new BlazeClient(config);
  }

  async connect(): Promise<void> {
    try {
      await this.client.getProducts({ page: 1, page_size: 1 });
      this._connected = true;
    } catch (err) {
      this._connected = false;
      if (err instanceof PosAdapterError) throw err;
      throw new PosAdapterError(
        `Blaze connection failed: ${(err as Error).message}`,
        'NETWORK',
        true,
        err,
      );
    }
  }

  async getProducts(filter: ProductFilter = {}): Promise<Page<Product>> {
    this.assertConnected();
    const params = buildProductParams(filter);
    const raw = await this.client.getProducts(params) as BlazeListResponse;
    const items = extractItems(raw);
    return buildPage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.map(row => normalizeProduct(row as Record<string, any>, this.tenantId)),
      raw,
      filter,
    );
  }

  async getInventory(filter: InventoryFilter = {}): Promise<Page<InventoryRecord>> {
    this.assertConnected();
    const params = buildInventoryParams(filter);
    const raw = await this.client.getInventory(params) as BlazeListResponse;
    const items = extractItems(raw);
    return buildPage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.map(row => normalizeInventory(row as Record<string, any>, this.tenantId)),
      raw,
      filter,
    );
  }

  async getSales(filter: SaleFilter = {}): Promise<Page<SaleTransaction>> {
    this.assertConnected();
    const params = buildSaleParams(filter);
    const raw = await this.client.getSales(params) as BlazeListResponse;
    const items = extractItems(raw);
    return buildPage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.map(row => normalizeSale(row as Record<string, any>, this.tenantId)),
      raw,
      filter,
    );
  }

  async getCustomers(filter: CustomerFilter = {}): Promise<Page<Customer>> {
    this.assertConnected();
    const params = buildCustomerParams(filter);
    const raw = await this.client.getCustomers(params) as BlazeListResponse;
    const items = extractItems(raw);
    return buildPage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.map(row => normalizeCustomer(row as Record<string, any>, this.tenantId)),
      raw,
      filter,
    );
  }

  private assertConnected(): void {
    if (!this._connected) {
      throw new PosAdapterError(
        'BlazeAdapter.connect() must be called before querying data',
        'UNKNOWN',
        false,
      );
    }
  }
}

function buildProductParams(
  filter: ProductFilter,
): Record<string, string | number | boolean | undefined> {
  return {
    page: filter.page ?? 1,
    page_size: filter.pageSize ?? DEFAULT_PAGE_SIZE,
    ...(filter.isActive !== undefined ? { is_active: filter.isActive } : {}),
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.search ? { search: filter.search } : {}),
  };
}

function buildInventoryParams(
  filter: InventoryFilter,
): Record<string, string | number | boolean | undefined> {
  return {
    page: filter.page ?? 1,
    page_size: filter.pageSize ?? DEFAULT_PAGE_SIZE,
    ...(filter.locationId ? { location_id: filter.locationId } : {}),
    ...(filter.productId ? { product_id: filter.productId } : {}),
    ...(filter.lowStockOnly ? { low_stock_only: true } : {}),
  };
}

function buildSaleParams(
  filter: SaleFilter,
): Record<string, string | number | boolean | undefined> {
  return {
    page: filter.page ?? 1,
    page_size: filter.pageSize ?? DEFAULT_PAGE_SIZE,
    ...(filter.startDate ? { start_date: filter.startDate } : {}),
    ...(filter.endDate ? { end_date: filter.endDate } : {}),
    ...(filter.customerId ? { customer_id: filter.customerId } : {}),
    ...(filter.staffId ? { staff_id: filter.staffId } : {}),
  };
}

function buildCustomerParams(
  filter: CustomerFilter,
): Record<string, string | number | boolean | undefined> {
  return {
    page: filter.page ?? 1,
    page_size: filter.pageSize ?? DEFAULT_PAGE_SIZE,
    ...(filter.search ? { search: filter.search } : {}),
    ...(filter.isActive !== undefined ? { is_active: filter.isActive } : {}),
  };
}

function extractItems(raw: BlazeListResponse): unknown[] {
  return raw.data ?? raw.items ?? [];
}

function buildPage<T>(
  items: T[],
  raw: BlazeListResponse,
  filter: { page?: number; pageSize?: number },
): Page<T> {
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? DEFAULT_PAGE_SIZE;
  const total = raw.total ?? raw.count ?? raw.pagination?.total ?? items.length;
  return {
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}
