/**
 * Winston agent tools — the bridge between Claude's tool-use and Winston's
 * data repositories.
 *
 * Each tool is defined as:
 *   - an Anthropic ToolParam (name, description, input_schema) for the LLM
 *   - an executor function that calls existing data repositories
 *
 * Adding a new tool:
 *   1. Add a ToolParam entry to TOOL_DEFINITIONS.
 *   2. Add the corresponding executor to TOOL_EXECUTORS.
 *   3. Both keys must match exactly.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { AgentContext } from './types';
import {
  getSalesSummary,
  getTopSellingProducts,
} from '../data/repositories/sales';
import {
  getLowStockItems,
  listInventory,
} from '../data/repositories/inventory';
import {
  listActiveMetrcPackages,
  getMetrcPackageByLabel,
} from '../data/repositories/metrc';

// ---- Tool definitions (sent to Claude) -------------------------------------

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'get_sales_summary',
    description:
      'Returns aggregate sales metrics for a date range: total transactions, ' +
      'total revenue, average basket size, tax collected, discounts given, ' +
      'and revenue broken down by payment method. Use for questions about ' +
      'revenue, sales performance, or payment trends.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start of the date range (ISO 8601, e.g. 2024-01-01)',
        },
        end_date: {
          type: 'string',
          description: 'End of the date range (ISO 8601, e.g. 2024-01-07)',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_top_selling_products',
    description:
      'Returns the top-selling products by revenue for a date range. ' +
      'Includes product name, total units sold, and total revenue per product. ' +
      'Use for questions about best sellers, product performance, or category trends.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start of the date range (ISO 8601)',
        },
        end_date: {
          type: 'string',
          description: 'End of the date range (ISO 8601)',
        },
        limit: {
          type: 'number',
          description: 'How many products to return (default 10, max 50)',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_low_stock_items',
    description:
      'Returns all inventory items currently at or below their reorder point. ' +
      'Includes product name, category, current quantity, reorder point, and ' +
      'reorder quantity. Use for questions about low stock, reorder alerts, or ' +
      'inventory health.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_inventory_snapshot',
    description:
      'Returns current inventory levels across all products. Optionally filter ' +
      'by location. Use for questions about on-hand quantities, stock levels, or ' +
      'location-specific inventory.',
    input_schema: {
      type: 'object',
      properties: {
        location_id: {
          type: 'string',
          description: 'Optional — filter to a specific location ID',
        },
        limit: {
          type: 'number',
          description: 'Max records to return (default 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'check_metrc_package',
    description:
      'Looks up a specific METRC package by its tag/label. Returns package ' +
      'details including item name, quantity, lab testing state, THC/CBD ' +
      'percentages, and active status. Use to answer compliance questions ' +
      'about a specific package tag.',
    input_schema: {
      type: 'object',
      properties: {
        package_label: {
          type: 'string',
          description: 'The METRC package tag/label (e.g. 1A4060300002DB8000000001)',
        },
      },
      required: ['package_label'],
    },
  },
  {
    name: 'get_active_metrc_packages',
    description:
      'Lists active (on-hand) METRC packages synced from compliance records. ' +
      'Optionally filter by item category. Use for broad compliance questions ' +
      'about on-hand inventory tracked in METRC, or lab testing status.',
    input_schema: {
      type: 'object',
      properties: {
        item_category: {
          type: 'string',
          description: 'Optional — filter by item category (e.g. "Flower", "Edible")',
        },
        limit: {
          type: 'number',
          description: 'Max packages to return (default 20)',
        },
      },
      required: [],
    },
  },
];

// ---- Source label map -------------------------------------------------------

/** Maps tool name → human-readable data source label for response attribution. */
export const TOOL_SOURCE_LABELS: Record<string, string> = {
  get_sales_summary: 'POS sales data',
  get_top_selling_products: 'POS sales data',
  get_low_stock_items: 'POS inventory data',
  get_inventory_snapshot: 'POS inventory data',
  check_metrc_package: 'METRC compliance records',
  get_active_metrc_packages: 'METRC compliance records',
};

// ---- Tool executor type ----------------------------------------------------

type ToolInput = Record<string, unknown>;
type ToolResult = unknown;

export type ToolExecutor = (
  input: ToolInput,
  ctx: AgentContext
) => Promise<ToolResult>;

// ---- Tool executors --------------------------------------------------------

function parseDate(val: unknown, fallback: Date): Date {
  if (typeof val === 'string' && val) {
    const d = new Date(val);
    return isNaN(d.getTime()) ? fallback : d;
  }
  return fallback;
}

const now = () => new Date();
const weekAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
};

const executors: Record<string, ToolExecutor> = {
  async get_sales_summary(input, ctx) {
    const start = parseDate(input.start_date, weekAgo());
    const end = parseDate(input.end_date, now());
    const summary = await getSalesSummary(ctx.sql, start, end);
    return {
      source: 'POS sales data',
      period: { start: start.toISOString(), end: end.toISOString() },
      ...summary,
    };
  },

  async get_top_selling_products(input, ctx) {
    const start = parseDate(input.start_date, weekAgo());
    const end = parseDate(input.end_date, now());
    const limit = typeof input.limit === 'number' ? Math.min(input.limit, 50) : 10;
    const products = await getTopSellingProducts(ctx.sql, start, end, limit);
    return {
      source: 'POS sales data',
      period: { start: start.toISOString(), end: end.toISOString() },
      products,
    };
  },

  async get_low_stock_items(_input, ctx) {
    const items = await getLowStockItems(ctx.sql);
    return {
      source: 'POS inventory data',
      count: items.length,
      items,
    };
  },

  async get_inventory_snapshot(input, ctx) {
    const locationId = typeof input.location_id === 'string' ? input.location_id : undefined;
    const limit = typeof input.limit === 'number' ? input.limit : 50;
    const rows = await listInventory(ctx.sql, { locationId, limit });
    return {
      source: 'POS inventory data',
      count: rows.length,
      items: rows.map((r) => ({
        productId: r.productId,
        location: r.locationName,
        quantityOnHand: r.quantityOnHand,
        quantityAvailable: r.quantityAvailable,
        reorderPoint: r.reorderPoint,
      })),
    };
  },

  async check_metrc_package(input, ctx) {
    const label = typeof input.package_label === 'string' ? input.package_label : '';
    const pkg = await getMetrcPackageByLabel(ctx.sql, label);
    if (!pkg) {
      return { source: 'METRC compliance records', found: false, label };
    }
    return {
      source: 'METRC compliance records',
      found: true,
      label: pkg.label,
      itemName: pkg.itemName,
      itemCategory: pkg.itemCategory,
      quantity: pkg.quantity,
      unitOfMeasure: pkg.unitOfMeasure,
      isActive: pkg.isActive,
      labTestingState: pkg.labTestingState,
      thcPercentage: pkg.thcPercentage,
      cbdPercentage: pkg.cbdPercentage,
      packagedDate: pkg.packagedDate,
      licenseNumber: pkg.licenseNumber,
    };
  },

  async get_active_metrc_packages(input, ctx) {
    const itemCategory = typeof input.item_category === 'string' ? input.item_category : undefined;
    const limit = typeof input.limit === 'number' ? Math.min(input.limit, 100) : 20;
    const packages = await listActiveMetrcPackages(ctx.sql, { itemCategory, limit });
    return {
      source: 'METRC compliance records',
      count: packages.length,
      packages: packages.map((p) => ({
        label: p.label,
        itemName: p.itemName,
        itemCategory: p.itemCategory,
        quantity: p.quantity,
        unitOfMeasure: p.unitOfMeasure,
        labTestingState: p.labTestingState,
        thcPercentage: p.thcPercentage,
        cbdPercentage: p.cbdPercentage,
        isActive: p.isActive,
      })),
    };
  },
};

/**
 * Execute a named tool with the given input and agent context.
 * Returns the tool result, or an error object if the tool is unknown or throws.
 */
export async function executeTool(
  toolName: string,
  input: ToolInput,
  ctx: AgentContext
): Promise<ToolResult> {
  const executor = executors[toolName];
  if (!executor) {
    return { error: `Unknown tool: ${toolName}` };
  }
  try {
    return await executor(input, ctx);
  } catch (err) {
    return { error: (err as Error).message ?? String(err) };
  }
}
