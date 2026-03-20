/**
 * Winston common POS schema.
 *
 * All POS adapters normalize their system-specific data into these types.
 * Downstream consumers (agent skills, reports, AI context) only see this schema.
 */

// ---- Product catalog -------------------------------------------------------

export type ProductCategory =
  | 'flower'
  | 'pre_roll'
  | 'concentrate'
  | 'edible'
  | 'tincture'
  | 'topical'
  | 'vape'
  | 'accessory'
  | 'other';

export interface Product {
  /** Stable internal product identifier (adapter-specific source id). */
  id: string;
  tenantId: string;
  /** SKU / barcode as shown in the POS. */
  sku: string;
  name: string;
  brand: string;
  category: ProductCategory;
  subcategory?: string;
  /** THC percentage (0–100), null if not tested or not applicable. */
  thcPct?: number;
  /** CBD percentage (0–100). */
  cbdPct?: number;
  /** Net weight in grams. */
  weightGrams?: number;
  priceRetail: number;       // USD, two decimal places
  priceMedical?: number;
  unitOfMeasure: string;     // "gram", "each", "mg", etc.
  metrcTag?: string;         // METRC tag / UID for compliance
  isActive: boolean;
  imageUrl?: string;
  description?: string;
  /** Raw adapter payload preserved for debugging / pass-through. */
  _raw?: unknown;
}

// ---- Inventory ------------------------------------------------------------

export interface InventoryRecord {
  id: string;
  tenantId: string;
  productId: string;        // foreign key → Product.id
  locationId: string;       // room / vault / floor
  locationName: string;
  quantityOnHand: number;
  quantityReserved: number; // held for open orders
  reorderPoint?: number;
  metrcTag?: string;
  unitCost?: number;        // average landed cost, USD
  lastReceivedAt?: string;  // ISO 8601
  updatedAt: string;        // ISO 8601
  _raw?: unknown;
}

// ---- Sales transactions ---------------------------------------------------

export type SaleStatus = 'completed' | 'voided' | 'refunded' | 'pending';
export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'check' | 'digital' | 'other';

export interface SaleLineItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
  metrcTag?: string;
}

export interface SaleTransaction {
  id: string;
  tenantId: string;
  receiptNumber: string;
  status: SaleStatus;
  customerId?: string;       // foreign key → Customer.id, null for walk-ins
  staffId?: string;
  registerId?: string;
  lineItems: SaleLineItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  completedAt: string;       // ISO 8601
  _raw?: unknown;
}

// ---- Customers ------------------------------------------------------------

export type CustomerType = 'recreational' | 'medical' | 'both';

export interface Customer {
  id: string;
  tenantId: string;
  externalId: string;        // POS-assigned customer id
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;      // ISO 8601 date (YYYY-MM-DD)
  customerType: CustomerType;
  medicalId?: string;        // medical card number
  loyaltyPoints?: number;
  totalSpend?: number;       // lifetime spend, USD
  visitCount?: number;
  lastVisitAt?: string;      // ISO 8601
  createdAt: string;         // ISO 8601
  isActive: boolean;
  _raw?: unknown;
}

// ---- Adapter error --------------------------------------------------------

export class PosAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: 'AUTH' | 'RATE_LIMIT' | 'NOT_FOUND' | 'NETWORK' | 'PARSE' | 'UNKNOWN',
    public readonly retryable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PosAdapterError';
  }
}
