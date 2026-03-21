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

function mapCategory(raw: string): ProductCategory {
  const s = (raw ?? '').toLowerCase().replace(/[^a-z_]/g, '_');
  const map: Record<string, ProductCategory> = {
    flower: 'flower',
    pre_roll: 'pre_roll',
    preroll: 'pre_roll',
    pre_rolls: 'pre_roll',
    concentrate: 'concentrate',
    extracts: 'concentrate',
    edible: 'edible',
    edibles: 'edible',
    tincture: 'tincture',
    tinctures: 'tincture',
    topical: 'topical',
    topicals: 'topical',
    vape: 'vape',
    cartridge: 'vape',
    accessory: 'accessory',
    accessories: 'accessory',
  };
  return map[s] ?? 'other';
}

function mapSaleStatus(raw: string): SaleStatus {
  const s = (raw ?? '').toLowerCase();
  if (s === 'completed' || s === 'complete' || s === 'closed') return 'completed';
  if (s === 'voided' || s === 'void' || s === 'cancelled') return 'voided';
  if (s === 'refunded' || s === 'refund') return 'refunded';
  return 'pending';
}

function mapPaymentMethod(raw: string): PaymentMethod {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('cash')) return 'cash';
  if (s.includes('debit')) return 'debit';
  if (s.includes('credit')) return 'credit';
  if (s.includes('check')) return 'check';
  if (s.includes('ach') || s.includes('digital') || s.includes('pay')) return 'digital';
  return 'other';
}

function mapCustomerType(raw: string): CustomerType {
  const s = (raw ?? '').toLowerCase();
  if (s === 'medical' || s === 'med') return 'medical';
  if (s === 'both' || s === 'dual') return 'both';
  return 'recreational';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeProduct(raw: Record<string, any>, tenantId: string): Product {
  return {
    id: safeStr(raw.id ?? raw.product_id),
    tenantId,
    sku: safeStr(raw.sku ?? raw.product_sku),
    name: safeStr(raw.name ?? raw.product_name),
    brand: safeStr(raw.brand ?? raw.brand_name),
    category: mapCategory(safeStr(raw.category ?? raw.product_type)),
    subcategory: raw.subcategory ? safeStr(raw.subcategory) : undefined,
    thcPct: raw.thc_pct !== undefined ? parseFloat2(raw.thc_pct) : undefined,
    cbdPct: raw.cbd_pct !== undefined ? parseFloat2(raw.cbd_pct) : undefined,
    weightGrams: raw.weight_grams !== undefined ? parseFloat2(raw.weight_grams) : undefined,
    priceRetail: parseFloat2(raw.price_retail ?? raw.retail_price ?? raw.price),
    priceMedical: raw.price_medical !== undefined ? parseFloat2(raw.price_medical) : undefined,
    unitOfMeasure: safeStr(raw.unit_of_measure ?? raw.unit ?? 'each'),
    metrcTag: raw.metrc_tag ?? raw.metrc_id ?? undefined,
    isActive: raw.is_active !== false && raw.status !== 'inactive',
    imageUrl: raw.image_url ?? raw.image ?? undefined,
    description: raw.description ?? undefined,
    _raw: raw,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeInventory(raw: Record<string, any>, tenantId: string): InventoryRecord {
  return {
    id: safeStr(raw.id ?? raw.inventory_id),
    tenantId,
    productId: safeStr(raw.product_id),
    locationId: safeStr(raw.location_id ?? raw.room_id ?? 'default'),
    locationName: safeStr(raw.location_name ?? raw.room_name ?? 'Default'),
    quantityOnHand: parseFloat2(raw.quantity_on_hand ?? raw.quantity ?? 0),
    quantityReserved: parseFloat2(raw.quantity_reserved ?? raw.reserved ?? 0),
    reorderPoint: raw.reorder_point !== undefined ? parseFloat2(raw.reorder_point) : undefined,
    metrcTag: raw.metrc_tag ?? raw.metrc_id ?? undefined,
    unitCost: raw.unit_cost !== undefined ? parseFloat2(raw.unit_cost) : undefined,
    lastReceivedAt: raw.last_received_at ?? undefined,
    updatedAt: safeStr(raw.updated_at ?? new Date().toISOString()),
    _raw: raw,
  };
}

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
  const rawItems: Record<string, any>[] = Array.isArray(raw.line_items ?? raw.items)
    ? (raw.line_items ?? raw.items)
    : [];

  const lineItems = rawItems.map(normalizeLineItem);
  const subtotal = parseFloat2(raw.subtotal ?? lineItems.reduce((sum, item) => sum + item.lineTotal, 0));

  return {
    id: safeStr(raw.id ?? raw.sale_id ?? raw.transaction_id),
    tenantId,
    receiptNumber: safeStr(raw.receipt_number ?? raw.order_number ?? raw.id),
    status: mapSaleStatus(safeStr(raw.status)),
    customerId: raw.customer_id ? safeStr(raw.customer_id) : undefined,
    staffId: raw.staff_id ? safeStr(raw.staff_id) : undefined,
    registerId: raw.register_id ? safeStr(raw.register_id) : undefined,
    lineItems,
    subtotal,
    discountTotal: parseFloat2(raw.discount_total ?? 0),
    taxTotal: parseFloat2(raw.tax_total ?? 0),
    total: parseFloat2(raw.total ?? subtotal),
    paymentMethod: mapPaymentMethod(safeStr(raw.payment_method ?? raw.payment_type)),
    completedAt: safeStr(raw.completed_at ?? raw.created_at ?? new Date().toISOString()),
    _raw: raw,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCustomer(raw: Record<string, any>, tenantId: string): Customer {
  return {
    id: safeStr(raw.id ?? raw.customer_id),
    tenantId,
    externalId: safeStr(raw.external_id ?? raw.id ?? raw.customer_id),
    firstName: safeStr(raw.first_name ?? raw.firstName),
    lastName: safeStr(raw.last_name ?? raw.lastName),
    email: raw.email ?? undefined,
    phone: raw.phone ?? raw.phone_number ?? undefined,
    dateOfBirth: raw.date_of_birth ?? raw.dob ?? undefined,
    customerType: mapCustomerType(safeStr(raw.customer_type ?? raw.type ?? 'recreational')),
    medicalId: raw.medical_id ?? raw.medical_card ?? undefined,
    loyaltyPoints: raw.loyalty_points !== undefined ? parseInt2(raw.loyalty_points) : undefined,
    totalSpend: raw.total_spend !== undefined ? parseFloat2(raw.total_spend) : undefined,
    visitCount: raw.visit_count !== undefined ? parseInt2(raw.visit_count) : undefined,
    lastVisitAt: raw.last_visit_at ?? undefined,
    createdAt: safeStr(raw.created_at ?? new Date().toISOString()),
    isActive: raw.is_active !== false && raw.status !== 'inactive',
    _raw: raw,
  };
}
