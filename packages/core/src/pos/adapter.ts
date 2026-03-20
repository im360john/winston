/**
 * IPosAdapter — the contract every POS connector must fulfil.
 *
 * Implementing a new POS (Dutchie, Blaze, …) means:
 *   1. Create src/pos/<name>/adapter.ts that implements IPosAdapter.
 *   2. Register it in src/pos/index.ts.
 *
 * No other changes are required in downstream code.
 */

import { Product, InventoryRecord, SaleTransaction, Customer } from '../types/pos';

// ---- Pagination ------------------------------------------------------------

export interface PageParams {
  /** 1-based page number. */
  page?: number;
  /** Max records per page (adapter may cap this). */
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ---- Filter params ---------------------------------------------------------

export interface ProductFilter extends PageParams {
  isActive?: boolean;
  category?: string;
  search?: string;
}

export interface InventoryFilter extends PageParams {
  locationId?: string;
  productId?: string;
  lowStockOnly?: boolean;
}

export interface SaleFilter extends PageParams {
  startDate?: string;   // ISO 8601 date string (YYYY-MM-DD)
  endDate?: string;
  customerId?: string;
  staffId?: string;
}

export interface CustomerFilter extends PageParams {
  search?: string;
  isActive?: boolean;
}

// ---- Adapter interface ----------------------------------------------------

export interface IPosAdapter {
  /** Human-readable name for logging and error messages. */
  readonly posType: string;

  /** True after a successful connection test. */
  readonly isConnected: boolean;

  /**
   * Validate credentials and reachability. Throws PosAdapterError on failure.
   * Must be called before any data method.
   */
  connect(): Promise<void>;

  /**
   * Release any persistent resources (keep-alive sockets, etc.).
   * No-op is acceptable; called on graceful shutdown.
   */
  disconnect(): Promise<void>;

  // -- Data methods ----------------------------------------------------------

  /** Fetch the product catalog. */
  getProducts(filter?: ProductFilter): Promise<Page<Product>>;

  /** Fetch current inventory levels. */
  getInventory(filter?: InventoryFilter): Promise<Page<InventoryRecord>>;

  /** Fetch completed sales transactions. */
  getSales(filter?: SaleFilter): Promise<Page<SaleTransaction>>;

  /** Fetch customer records. */
  getCustomers(filter?: CustomerFilter): Promise<Page<Customer>>;
}

// ---- Base class (optional convenience) ------------------------------------

/**
 * BasePosAdapter provides default disconnect() and isConnected tracking.
 * Extend it or implement IPosAdapter directly — either is fine.
 */
export abstract class BasePosAdapter implements IPosAdapter {
  abstract readonly posType: string;

  protected _connected = false;

  get isConnected(): boolean {
    return this._connected;
  }

  abstract connect(): Promise<void>;

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  abstract getProducts(filter?: ProductFilter): Promise<Page<Product>>;
  abstract getInventory(filter?: InventoryFilter): Promise<Page<InventoryRecord>>;
  abstract getSales(filter?: SaleFilter): Promise<Page<SaleTransaction>>;
  abstract getCustomers(filter?: CustomerFilter): Promise<Page<Customer>>;
}
