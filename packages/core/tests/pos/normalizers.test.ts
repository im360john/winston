/**
 * Treez normalizer tests.
 *
 * These tests run without any network calls — they validate the mapping logic
 * from raw Treez API shapes to the canonical Winston schema.
 */

import {
  normalizeProduct,
  normalizeInventory,
  normalizeSale,
  normalizeCustomer,
} from '../../src/pos/treez/normalizers';

const TENANT = 'tenant-abc';

// ---- Product ---------------------------------------------------------------

describe('normalizeProduct', () => {
  test('maps standard fields', () => {
    const raw = {
      product_id: 'p-1',
      sku: 'SKU-001',
      product_name: 'Blue Dream 3.5g',
      brand: 'House Brand',
      product_type: 'Flower',
      thc: '22.5',
      cbd: '0.1',
      net_weight: '3.5',
      price_retail: '45.00',
      unit_of_measure: 'gram',
      is_active: true,
    };
    const product = normalizeProduct(raw, TENANT);
    expect(product.id).toBe('p-1');
    expect(product.tenantId).toBe(TENANT);
    expect(product.sku).toBe('SKU-001');
    expect(product.name).toBe('Blue Dream 3.5g');
    expect(product.brand).toBe('House Brand');
    expect(product.category).toBe('flower');
    expect(product.thcPct).toBe(22.5);
    expect(product.cbdPct).toBe(0.1);
    expect(product.weightGrams).toBe(3.5);
    expect(product.priceRetail).toBe(45);
    expect(product.isActive).toBe(true);
  });

  test('maps pre_roll category variants', () => {
    expect(normalizeProduct({ product_type: 'Pre-Roll' }, TENANT).category).toBe('pre_roll');
    expect(normalizeProduct({ product_type: 'Preroll' }, TENANT).category).toBe('pre_roll');
    expect(normalizeProduct({ product_type: 'PRE_ROLLS' }, TENANT).category).toBe('pre_roll');
  });

  test('falls back to other for unknown category', () => {
    expect(normalizeProduct({ product_type: 'Mystery' }, TENANT).category).toBe('other');
  });

  test('preserves _raw', () => {
    const raw = { product_id: 'x', custom_field: 'foo' };
    expect(normalizeProduct(raw, TENANT)._raw).toBe(raw);
  });

  test('handles missing optional fields gracefully', () => {
    const product = normalizeProduct({ product_id: 'x' }, TENANT);
    expect(product.thcPct).toBeUndefined();
    expect(product.cbdPct).toBeUndefined();
    expect(product.metrcTag).toBeUndefined();
    expect(product.isActive).toBe(true);
  });

  test('inactive flag via status field', () => {
    const product = normalizeProduct({ product_id: 'x', status: 'inactive' }, TENANT);
    expect(product.isActive).toBe(false);
  });
});

// ---- Inventory -------------------------------------------------------------

describe('normalizeInventory', () => {
  test('maps standard fields', () => {
    const raw = {
      inventory_id: 'inv-1',
      product_id: 'p-1',
      room_id: 'room-floor',
      room_name: 'Sales Floor',
      quantity_on_hand: '150.5',
      quantity_reserved: '10',
      unit_cost: '12.50',
      updated_at: '2026-01-15T10:00:00Z',
    };
    const inv = normalizeInventory(raw, TENANT);
    expect(inv.id).toBe('inv-1');
    expect(inv.productId).toBe('p-1');
    expect(inv.locationId).toBe('room-floor');
    expect(inv.locationName).toBe('Sales Floor');
    expect(inv.quantityOnHand).toBe(150.5);
    expect(inv.quantityReserved).toBe(10);
    expect(inv.unitCost).toBe(12.5);
    expect(inv.updatedAt).toBe('2026-01-15T10:00:00Z');
  });

  test('defaults location to "default" when missing', () => {
    const inv = normalizeInventory({ inventory_id: 'x', product_id: 'p' }, TENANT);
    expect(inv.locationId).toBe('default');
    expect(inv.locationName).toBe('Default');
  });
});

// ---- Sale ------------------------------------------------------------------

describe('normalizeSale', () => {
  test('maps a completed order with line items', () => {
    const raw = {
      order_id: 'ord-1',
      receipt_number: 'RCP-100',
      status: 'completed',
      customer_id: 'cust-5',
      payment_method: 'cash',
      subtotal: '44.00',
      discount_total: '0.00',
      tax_total: '4.40',
      total: '48.40',
      completed_at: '2026-02-01T14:30:00Z',
      line_items: [
        {
          product_id: 'p-1',
          product_name: 'Blue Dream',
          sku: 'SKU-001',
          quantity: '1',
          unit_price: '45.00',
          discount: '1.00',
          tax: '4.40',
          line_total: '48.40',
        },
      ],
    };
    const sale = normalizeSale(raw, TENANT);
    expect(sale.id).toBe('ord-1');
    expect(sale.status).toBe('completed');
    expect(sale.customerId).toBe('cust-5');
    expect(sale.paymentMethod).toBe('cash');
    expect(sale.total).toBe(48.4);
    expect(sale.lineItems).toHaveLength(1);
    expect(sale.lineItems[0].productId).toBe('p-1');
    expect(sale.lineItems[0].quantity).toBe(1);
    expect(sale.lineItems[0].unitPrice).toBe(45);
  });

  test('maps sale status variants', () => {
    expect(normalizeSale({ status: 'void' }, TENANT).status).toBe('voided');
    expect(normalizeSale({ status: 'refund' }, TENANT).status).toBe('refunded');
    expect(normalizeSale({ status: 'complete' }, TENANT).status).toBe('completed');
    expect(normalizeSale({ status: 'open' }, TENANT).status).toBe('pending');
  });

  test('maps payment methods', () => {
    expect(normalizeSale({ payment_method: 'debit_card' }, TENANT).paymentMethod).toBe('debit');
    expect(normalizeSale({ payment_method: 'digital_pay' }, TENANT).paymentMethod).toBe('digital');
    expect(normalizeSale({ payment_method: 'unknown' }, TENANT).paymentMethod).toBe('other');
  });

  test('handles missing line_items gracefully', () => {
    const sale = normalizeSale({ order_id: 'x' }, TENANT);
    expect(sale.lineItems).toEqual([]);
  });
});

// ---- Customer --------------------------------------------------------------

describe('normalizeCustomer', () => {
  test('maps standard fields', () => {
    const raw = {
      customer_id: 'cust-1',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '555-1234',
      date_of_birth: '1990-05-15',
      customer_type: 'recreational',
      loyalty_points: '250',
      total_spend: '1200.50',
      visit_count: '14',
      last_visit_at: '2026-02-10T18:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      is_active: true,
    };
    const customer = normalizeCustomer(raw, TENANT);
    expect(customer.id).toBe('cust-1');
    expect(customer.firstName).toBe('Jane');
    expect(customer.lastName).toBe('Doe');
    expect(customer.email).toBe('jane@example.com');
    expect(customer.customerType).toBe('recreational');
    expect(customer.loyaltyPoints).toBe(250);
    expect(customer.totalSpend).toBe(1200.5);
    expect(customer.visitCount).toBe(14);
    expect(customer.isActive).toBe(true);
  });

  test('maps customer type variants', () => {
    expect(normalizeCustomer({ customer_type: 'med' }, TENANT).customerType).toBe('medical');
    expect(normalizeCustomer({ customer_type: 'dual' }, TENANT).customerType).toBe('both');
    expect(normalizeCustomer({ customer_type: 'rec' }, TENANT).customerType).toBe('recreational');
  });

  test('handles missing optional fields', () => {
    const c = normalizeCustomer({ customer_id: 'x' }, TENANT);
    expect(c.email).toBeUndefined();
    expect(c.loyaltyPoints).toBeUndefined();
    expect(c.medicalId).toBeUndefined();
  });
});
