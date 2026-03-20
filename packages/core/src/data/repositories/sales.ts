/**
 * Sales repository — transactions + line items, tenant-scoped via RLS.
 */

import type { SqlContext } from '../../db/types';

export interface SaleTransactionRow {
  id: string;
  tenantId: string;
  externalId: string;
  posType: string;
  customerId: string | null;
  employeeId: string | null;
  employeeName: string | null;
  registerId: string | null;
  locationId: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  status: string;
  saleType: string;
  completedAt: Date;
  syncedAt: Date;
}

export interface SaleLineItemRow {
  id: string;
  tenantId: string;
  transactionId: string;
  productId: string | null;
  externalId: string | null;
  productName: string;
  productCategory: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
  metrcTag: string | null;
}

export interface UpsertSaleInput {
  tenantId: string;
  externalId: string;
  posType: string;
  customerId?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  registerId?: string | null;
  locationId?: string | null;
  subtotal: number;
  discountTotal?: number;
  taxTotal?: number;
  total: number;
  paymentMethod: string;
  status?: string;
  saleType?: string;
  completedAt: Date;
  rawPayload?: Record<string, unknown>;
  lineItems: UpsertLineItemInput[];
}

export interface UpsertLineItemInput {
  tenantId: string;
  externalId?: string | null;
  productId?: string | null;
  productName: string;
  productCategory?: string | null;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  lineTotal: number;
  metrcTag?: string | null;
  rawPayload?: Record<string, unknown>;
}

export interface SalesFilter {
  startDate?: Date;
  endDate?: Date;
  employeeId?: string;
  customerId?: string;
  paymentMethod?: string;
  saleType?: string;
  limit?: number;
  offset?: number;
}

export interface SalesSummary {
  totalTransactions: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  averageBasket: number;
  byPaymentMethod: Record<string, { count: number; revenue: number }>;
}

function mapTxRow(row: Record<string, unknown>): SaleTransactionRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    externalId: row.external_id as string,
    posType: row.pos_type as string,
    customerId: row.customer_id as string | null,
    employeeId: row.employee_id as string | null,
    employeeName: row.employee_name as string | null,
    registerId: row.register_id as string | null,
    locationId: row.location_id as string | null,
    subtotal: row.subtotal as number,
    discountTotal: row.discount_total as number,
    taxTotal: row.tax_total as number,
    total: row.total as number,
    paymentMethod: row.payment_method as string,
    status: row.status as string,
    saleType: row.sale_type as string,
    completedAt: row.completed_at as Date,
    syncedAt: row.synced_at as Date,
  };
}

export async function upsertSale(
  sql: SqlContext,
  input: UpsertSaleInput
): Promise<SaleTransactionRow> {
  const [tx] = await sql`
    INSERT INTO sale_transactions (
      tenant_id, external_id, pos_type, customer_id, employee_id, employee_name,
      register_id, location_id, subtotal, discount_total, tax_total, total,
      payment_method, status, sale_type, completed_at, raw_payload, synced_at
    ) VALUES (
      ${input.tenantId}, ${input.externalId}, ${input.posType},
      ${input.customerId ?? null}, ${input.employeeId ?? null}, ${input.employeeName ?? null},
      ${input.registerId ?? null}, ${input.locationId ?? null},
      ${input.subtotal}, ${input.discountTotal ?? 0}, ${input.taxTotal ?? 0}, ${input.total},
      ${input.paymentMethod}, ${input.status ?? 'completed'}, ${input.saleType ?? 'retail'},
      ${input.completedAt.toISOString()},
      ${input.rawPayload ? JSON.stringify(input.rawPayload) : null},
      NOW()
    )
    ON CONFLICT (tenant_id, external_id, pos_type) DO UPDATE SET
      customer_id    = EXCLUDED.customer_id,
      employee_id    = EXCLUDED.employee_id,
      employee_name  = EXCLUDED.employee_name,
      subtotal       = EXCLUDED.subtotal,
      discount_total = EXCLUDED.discount_total,
      tax_total      = EXCLUDED.tax_total,
      total          = EXCLUDED.total,
      payment_method = EXCLUDED.payment_method,
      status         = EXCLUDED.status,
      raw_payload    = EXCLUDED.raw_payload,
      synced_at      = NOW()
    RETURNING *
  `;

  // Replace line items on upsert (simpler than diffing)
  await sql`DELETE FROM sale_line_items WHERE transaction_id = ${tx.id}`;

  for (const item of input.lineItems) {
    await sql`
      INSERT INTO sale_line_items (
        tenant_id, transaction_id, product_id, external_id,
        product_name, product_category, quantity, unit_price,
        discount, tax, line_total, metrc_tag, raw_payload
      ) VALUES (
        ${item.tenantId}, ${tx.id}, ${item.productId ?? null}, ${item.externalId ?? null},
        ${item.productName}, ${item.productCategory ?? null},
        ${item.quantity}, ${item.unitPrice},
        ${item.discount ?? 0}, ${item.tax ?? 0}, ${item.lineTotal},
        ${item.metrcTag ?? null},
        ${item.rawPayload ? JSON.stringify(item.rawPayload) : null}
      )
    `;
  }

  return mapTxRow(tx);
}

export async function listSales(
  sql: SqlContext,
  filter: SalesFilter = {}
): Promise<SaleTransactionRow[]> {
  const rows = await sql`
    SELECT * FROM sale_transactions
    WHERE TRUE
      ${filter.startDate ? sql`AND completed_at >= ${filter.startDate.toISOString()}` : sql``}
      ${filter.endDate ? sql`AND completed_at <= ${filter.endDate.toISOString()}` : sql``}
      ${filter.employeeId ? sql`AND employee_id = ${filter.employeeId}` : sql``}
      ${filter.customerId ? sql`AND customer_id = ${filter.customerId}` : sql``}
      ${filter.paymentMethod ? sql`AND payment_method = ${filter.paymentMethod}` : sql``}
      ${filter.saleType ? sql`AND sale_type = ${filter.saleType}` : sql``}
    ORDER BY completed_at DESC
    LIMIT ${filter.limit ?? 100} OFFSET ${filter.offset ?? 0}
  `;
  return rows.map(mapTxRow);
}

export async function getSalesSummary(
  sql: SqlContext,
  startDate: Date,
  endDate: Date
): Promise<SalesSummary> {
  const [agg] = await sql`
    SELECT
      COUNT(*)::INTEGER                        AS total_transactions,
      COALESCE(SUM(total), 0)                  AS total_revenue,
      COALESCE(SUM(tax_total), 0)              AS total_tax,
      COALESCE(SUM(discount_total), 0)         AS total_discount,
      COALESCE(AVG(total), 0)                  AS average_basket
    FROM sale_transactions
    WHERE completed_at BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
      AND status = 'completed'
  `;

  const byMethod = await sql`
    SELECT
      payment_method,
      COUNT(*)::INTEGER  AS count,
      SUM(total)         AS revenue
    FROM sale_transactions
    WHERE completed_at BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
      AND status = 'completed'
    GROUP BY payment_method
  `;

  const byPaymentMethod: Record<string, { count: number; revenue: number }> = {};
  for (const row of byMethod) {
    byPaymentMethod[row.payment_method as string] = {
      count: row.count as number,
      revenue: row.revenue as number,
    };
  }

  return {
    totalTransactions: agg.total_transactions as number,
    totalRevenue: agg.total_revenue as number,
    totalTax: agg.total_tax as number,
    totalDiscount: agg.total_discount as number,
    averageBasket: agg.average_basket as number,
    byPaymentMethod,
  };
}

export async function getLineItemsForSale(
  sql: SqlContext,
  transactionId: string
): Promise<SaleLineItemRow[]> {
  const rows = await sql`
    SELECT * FROM sale_line_items WHERE transaction_id = ${transactionId}
  `;
  return rows.map((r) => ({
    id: r.id as string,
    tenantId: r.tenant_id as string,
    transactionId: r.transaction_id as string,
    productId: r.product_id as string | null,
    externalId: r.external_id as string | null,
    productName: r.product_name as string,
    productCategory: r.product_category as string | null,
    quantity: r.quantity as number,
    unitPrice: r.unit_price as number,
    discount: r.discount as number,
    tax: r.tax as number,
    lineTotal: r.line_total as number,
    metrcTag: r.metrc_tag as string | null,
  }));
}

export async function getTopSellingProducts(
  sql: SqlContext,
  startDate: Date,
  endDate: Date,
  limit = 10
): Promise<{ productId: string | null; productName: string; totalQty: number; totalRevenue: number }[]> {
  const rows = await sql`
    SELECT
      sli.product_id,
      sli.product_name,
      SUM(sli.quantity)::NUMERIC   AS total_qty,
      SUM(sli.line_total)::NUMERIC AS total_revenue
    FROM sale_line_items sli
    JOIN sale_transactions st ON st.id = sli.transaction_id
    WHERE st.completed_at BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
      AND st.status = 'completed'
    GROUP BY sli.product_id, sli.product_name
    ORDER BY total_revenue DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    productId: r.product_id as string | null,
    productName: r.product_name as string,
    totalQty: r.total_qty as number,
    totalRevenue: r.total_revenue as number,
  }));
}
