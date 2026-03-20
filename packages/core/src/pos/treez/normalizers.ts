/**
 * Treez → Winston schema normalizers.
 *
 * Each function takes a raw Treez API object and returns the canonical
 * Winston type. Unknown or unmapped fields are preserved in `_raw` for
 * debugging and future mapping.
 *
 * Treez API field names are based on the v2 REST API shape.
 */

import {
  Product,
  ProductCategory,
  InventoryRecord,
  SaleTransaction,
  SaleLineItem,
  SaleStatus,
  PaymentMethod,
  Customer,
  CustomerType,
} from '../../types/pos';

// ---- Helpers ---------------------------------------------------------------

function parseFloat2(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function parseInt2(v: unknown): number {
  const n = parseInt(String(v ?? 0), 10);
  return isNaN(n) ? 0 : n;
}

function safeStr(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

/**
 * Map Treez product_type strings to Winston ProductCategory.
 * Treez uses mixed-case strings; we normalise to our enum.
 */
function mapCategory(raw: string): ProductCategory {
  const s = (raw ?? '').toLowerCase().replace(/[^a-z_]/g, '_');
  const map: Record<string, ProductCategory> = {
    flower: 'flower',
    pre_roll: 'pre_roll',
    preroll: 'pre_roll',
    pre_rolls: 'pre_roll',
    concentrate: 'concentrate',
    concentrates: 'concentrate',
    extract: 'concentrate',
    edible: 'edible',
    edibles: 'edible',
    tincture: 'tincture',
    tinctures: 'tincture',
    topical: 'topical',
    topicals: 'topical',
    vape: 'vape',
    vaporizer: 'vape',
    cartridge: 'vape',
    accessory: 'accessory',
    accessories: 'accessory',
    gear: 'accessory',
  };
  return map[s] ?? 'other';
}

function mapSaleStatus(raw: string): SaleStatus {
  const s = (raw ?? '').toLowerCase();
  if (s === 'completed' || s === 'complete') return 'completed';
  if (s === 'voided' || s === 'void') return 'voided';
  if (s === 'refunded' || s === 'refund') return 'refunded';
  return 'pending';
}

function mapPaymentMethod(raw: string): PaymentMethod {
  const s = (raw ?? '').toLowerCase();
  if (s === 'cash') return 'cash';
  if (s === 'debit' || s === 'debit_card') return 'debit';
  if (s === 'credit' || s === 'credit_card') return 'credit';
  if (s === 'check') return 'check';
  if (s.includes('digital') || s.includes('pay') || s.includes('app')) return 'digital';
  return 'other';
}

function mapCustomerType(raw: string): CustomerType {
  const s = (raw ?? '').toLowerCase();
  if (s === 'medical' || s === 'med') return 'medical';
  if (s === 'both' || s === 'dual') return 'both';
  return 'recreational';
}

// ---- Product normalizer ----------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeProduct(raw: Record<string, any>, tenantId: string): Product {
  return {
    id: safeStr(raw.product_id ?? raw.id),
    tenantId,
    sku: safeStr(raw.sku ?? raw.product_sku),
    name: safeStr(raw.product_name ?? raw.name),
    brand: safeStr(raw.brand ?? raw.brand_name),
    category: mapCategory(safeStr(raw.product_type ?? raw.category)),
    subcategory: raw.subcategory ? safeStr(raw.subcategory) : undefined,
    thcPct: raw.thc !== undefined ? parseFloat2(raw.thc) : undefined,
    cbdPct: raw.cbd !== undefined ? parseFloat2(raw.cbd) : undefined,
    weightGrams: raw.net_weight !== undefined ? parseFloat2(raw.net_weight) : undefined,
    priceRetail: parseFloat2(raw.price_retail ?? raw.price ?? raw.retail_price),
    priceMedical: raw.price_medical !== undefined ? parseFloat2(raw.price_medical) : undefined,
    unitOfMeasure: safeStr(raw.unit_of_measure ?? raw.unit ?? 'each'),
    metrcTag: raw.metrc_id ?? raw.metrc_tag ?? undefined,
    isActive: raw.is_active !== false && raw.status !== 'inactive',
    imageUrl: raw.image_url ?? raw.image ?? undefined,
    description: raw.description ?? undefined,
    _raw: raw,
  };
}

// ---- Inventory normalizer --------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeInventory(raw: Record<string, any>, tenantId: string): InventoryRecord {
  return {
    id: safeStr(raw.inventory_id ?? raw.id),
    tenantId,
    productId: safeStr(raw.product_id),
    locationId: safeStr(raw.room_id ?? raw.location_id ?? 'default'),
    locationName: safeStr(raw.room_name ?? raw.location_name ?? 'Default'),
    quantityOnHand: parseFloat2(raw.quantity_on_hand ?? raw.quantity ?? 0),
    quantityReserved: parseFloat2(raw.quantity_reserved ?? raw.reserved ?? 0),
    reorderPoint: raw.reorder_point !== undefined ? parseFloat2(raw.reorder_point) : undefined,
    metrcTag: raw.metrc_tag ?? raw.metrc_id ?? undefined,
    unitCost: raw.unit_cost !== undefined ? parseFloat2(raw.unit_cost) : undefined,
    lastReceivedAt: raw.last_received_at ?? raw.received_date ?? undefined,
    updatedAt: safeStr(raw.updated_at ?? raw.last_updated ?? new Date().toISOString()),
    _raw: raw,
  };
}

// ---- Sale normalizer -------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeLineItem(raw: Record<string, any>): SaleLineItem {
  const unitPrice = parseFloat2(raw.unit_price ?? raw.price ?? 0);
  const quantity = parseFloat2(raw.quantity ?? raw.qty ?? 1);
  const discount = parseFloat2(raw.discount ?? raw.discount_amount ?? 0);
  const tax = parseFloat2(raw.tax ?? raw.tax_amount ?? 0);
  const lineTotal = parseFloat2(raw.line_total ?? unitPrice * quantity - discount + tax);

  return {
    productId: safeStr(raw.product_id),
    productName: safeStr(raw.product_name ?? raw.name),
    sku: safeStr(raw.sku ?? raw.product_sku),
    quantity,
    unitPrice,
    discount,
    tax,
    lineTotal,
    metrcTag: raw.metrc_tag ?? raw.metrc_id ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeSale(raw: Record<string, any>, tenantId: string): SaleTransaction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: Record<string, any>[] = Array.isArray(raw.line_items ?? raw.items ?? raw.order_items)
    ? (raw.line_items ?? raw.items ?? raw.order_items)
    : [];

  const lineItems = rawItems.map(normalizeLineItem);
  const subtotal = parseFloat2(raw.subtotal ?? lineItems.reduce((s, l) => s + l.lineTotal, 0));

  return {
    id: safeStr(raw.order_id ?? raw.transaction_id ?? raw.id),
    tenantId,
    receiptNumber: safeStr(raw.receipt_number ?? raw.order_number ?? raw.order_id),
    status: mapSaleStatus(safeStr(raw.status ?? raw.order_status)),
    customerId: raw.customer_id ? safeStr(raw.customer_id) : undefined,
    staffId: raw.staff_id ?? raw.employee_id ?? undefined,
    registerId: raw.register_id ?? raw.terminal_id ?? undefined,
    lineItems,
    subtotal,
    discountTotal: parseFloat2(raw.discount_total ?? raw.total_discount ?? 0),
    taxTotal: parseFloat2(raw.tax_total ?? raw.total_tax ?? 0),
    total: parseFloat2(raw.total ?? raw.grand_total ?? subtotal),
    paymentMethod: mapPaymentMethod(safeStr(raw.payment_method ?? raw.payment_type)),
    completedAt: safeStr(raw.completed_at ?? raw.created_at ?? raw.order_date ?? new Date().toISOString()),
    _raw: raw,
  };
}

// ---- Customer normalizer ---------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCustomer(raw: Record<string, any>, tenantId: string): Customer {
  const firstName = safeStr(raw.first_name ?? raw.firstName ?? '');
  const lastName = safeStr(raw.last_name ?? raw.lastName ?? '');

  return {
    id: safeStr(raw.customer_id ?? raw.loyalty_id ?? raw.id),
    tenantId,
    externalId: safeStr(raw.customer_id ?? raw.external_id ?? raw.id),
    firstName,
    lastName,
    email: raw.email ?? undefined,
    phone: raw.phone ?? raw.phone_number ?? raw.cell_phone ?? undefined,
    dateOfBirth: raw.date_of_birth ?? raw.dob ?? undefined,
    customerType: mapCustomerType(safeStr(raw.customer_type ?? raw.type ?? 'recreational')),
    medicalId: raw.medical_id ?? raw.medical_card ?? undefined,
    loyaltyPoints: raw.loyalty_points !== undefined ? parseInt2(raw.loyalty_points) : undefined,
    totalSpend: raw.total_spend !== undefined ? parseFloat2(raw.total_spend) : undefined,
    visitCount: raw.visit_count !== undefined ? parseInt2(raw.visit_count) : undefined,
    lastVisitAt: raw.last_visit_at ?? raw.last_visit ?? undefined,
    createdAt: safeStr(raw.created_at ?? raw.registration_date ?? new Date().toISOString()),
    isActive: raw.is_active !== false && raw.status !== 'inactive',
    _raw: raw,
  };
}
