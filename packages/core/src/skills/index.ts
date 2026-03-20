/**
 * Winston Skills — public entry point.
 *
 * Wires the registry, engine, and all built-in skills together.
 * Import this module once at server startup to ensure all skills are registered.
 *
 * Usage:
 *   import './skills';  // registers built-ins as a side effect
 *   import { skillRegistry, skillEngine } from './skills';
 */

export { skillRegistry } from './registry';
export { skillEngine, SkillNotFoundError, PermissionDeniedError } from './engine';
export type { SkillHandler } from './engine';
export type {
  SkillContext,
  SkillDefinition,
  SkillExecution,
  SkillResult,
  SkillStep,
} from './types';

import { skillRegistry } from './registry';
import { inventoryReorderAlertSkill } from './builtins/inventory-reorder-alert';
import { endOfDayReconciliationSkill } from './builtins/end-of-day-reconciliation';
import { complianceCheckSkill } from './builtins/compliance-check';

// Register all built-in skills at module load time.
skillRegistry.register(inventoryReorderAlertSkill);
skillRegistry.register(endOfDayReconciliationSkill);
skillRegistry.register(complianceCheckSkill);
