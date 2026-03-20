/**
 * Built-in skill: inventory-reorder-alert
 *
 * Monitors current inventory levels and surfaces items that are at or below
 * their reorder point. For each item, it generates a reorder suggestion
 * (product, suggested quantity, priority tier).
 *
 * Steps:
 *   1. fetch-low-stock   — query DB for all items at/below reorder point
 *   2. generate-alerts   — rank by severity and build reorder suggestions
 *
 * Output:
 *   {
 *     totalAlertsCount: number;
 *     criticalCount: number;   // quantity == 0
 *     warningCount: number;    // 0 < qty <= reorderPoint
 *     alerts: ReorderAlert[];
 *   }
 */

import type { SkillContext, SkillStep } from '../types';
import type { SkillHandler } from '../engine';
import { makeStep, runStep } from '../engine';
import { getLowStockItems } from '../../data/repositories/inventory';

export interface ReorderAlert {
  productId: string;
  productName: string;
  category: string;
  locationName: string | null;
  quantityAvailable: number;
  reorderPoint: number;
  suggestedOrderQuantity: number;
  /** 'critical' = zero stock; 'warning' = below reorder point. */
  priority: 'critical' | 'warning';
}

export interface InventoryReorderAlertOutput {
  totalAlertsCount: number;
  criticalCount: number;
  warningCount: number;
  alerts: ReorderAlert[];
}

export const inventoryReorderAlertSkill: SkillHandler = {
  definition: {
    id: 'inventory-reorder-alert',
    name: 'Inventory Reorder Alert',
    description:
      'Checks all inventory items for stock levels at or below their reorder ' +
      'point and generates prioritized reorder suggestions. Critical items have ' +
      'zero stock; warning items are low but not empty.',
    version: '1.0.0',
    category: 'inventory',
    requiredPermissions: ['inventory:read'],
    parameters: {},
  },

  async execute(
    _params: Record<string, unknown>,
    ctx: SkillContext,
    steps: SkillStep[]
  ): Promise<InventoryReorderAlertOutput> {
    // ── Step 1: fetch low-stock items ────────────────────────────────────────
    const fetchStep = makeStep('fetch-low-stock', 'Fetch low-stock inventory items');
    steps.push(fetchStep);

    const lowStockItems = await runStep(fetchStep, () =>
      getLowStockItems(ctx.sql)
    );

    // ── Step 2: generate alerts ──────────────────────────────────────────────
    const alertStep = makeStep('generate-alerts', 'Generate reorder alerts and suggestions');
    steps.push(alertStep);

    const alerts = await runStep(alertStep, async () => {
      return lowStockItems.map((item): ReorderAlert => {
        const priority: 'critical' | 'warning' =
          item.quantityAvailable <= 0 ? 'critical' : 'warning';

        // Suggested order: at minimum the configured reorder quantity;
        // if already at zero, suggest 2× to rebuild buffer stock.
        const suggestedOrderQuantity =
          priority === 'critical'
            ? item.reorderQuantity * 2
            : item.reorderQuantity;

        return {
          productId: item.productId,
          productName: item.productName,
          category: item.category,
          locationName: item.locationName,
          quantityAvailable: item.quantityAvailable,
          reorderPoint: item.reorderPoint,
          suggestedOrderQuantity,
          priority,
        };
      });
    });

    const criticalCount = (alerts as ReorderAlert[]).filter((a) => a.priority === 'critical').length;
    const warningCount = (alerts as ReorderAlert[]).filter((a) => a.priority === 'warning').length;

    return {
      totalAlertsCount: (alerts as ReorderAlert[]).length,
      criticalCount,
      warningCount,
      alerts: alerts as ReorderAlert[],
    };
  },
};
