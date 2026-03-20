/**
 * Task handler: restock-recommendation
 *
 * Delegates to the inventory-reorder-alert skill to analyze current stock
 * levels and produce a prioritized list of reorder recommendations.
 *
 * Required permissions: inventory:read
 * Output: InventoryReorderAlertOutput (see skills/builtins/inventory-reorder-alert.ts)
 */

import type { TaskHandler, TaskContext, TaskStep } from '../types';
import { inventoryReorderAlertSkill } from '../../skills/builtins/inventory-reorder-alert';

export const restockRecommendationHandler: TaskHandler = {
  type: 'restock-recommendation',
  requiredPermissions: ['inventory:read'],

  execute(
    params: Record<string, unknown>,
    ctx: TaskContext,
    steps: TaskStep[]
  ): Promise<unknown> {
    return inventoryReorderAlertSkill.execute(params, ctx, steps);
  },
};
