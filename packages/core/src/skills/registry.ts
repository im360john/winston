/**
 * Winston Skill Registry.
 *
 * The registry is the central catalog of all available skills. Skills are
 * registered at startup and can be discovered by the agent runtime and the
 * HTTP API.
 *
 * Adding a new skill:
 *   1. Implement SkillHandler (see engine.ts for the interface).
 *   2. Call skillRegistry.register(handler) in src/skills/index.ts.
 *
 * No modifications to the engine or registry are needed when adding skills.
 */

import type { SkillDefinition } from './types';
import type { SkillHandler } from './engine';

export class SkillRegistry {
  private readonly handlers = new Map<string, SkillHandler>();

  /**
   * Register a skill handler.
   * Throws if a skill with the same ID is already registered — IDs must be unique.
   */
  register(handler: SkillHandler): void {
    const { id } = handler.definition;
    if (this.handlers.has(id)) {
      throw new Error(`Skill '${id}' is already registered`);
    }
    this.handlers.set(id, handler);
  }

  /** Return the handler for a skill ID, or undefined if not registered. */
  get(id: string): SkillHandler | undefined {
    return this.handlers.get(id);
  }

  /** Return definitions for all registered skills. */
  list(): SkillDefinition[] {
    return Array.from(this.handlers.values()).map((h) => h.definition);
  }
}

/** Shared singleton registry — populated at startup by src/skills/index.ts. */
export const skillRegistry = new SkillRegistry();
