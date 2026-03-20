/**
 * Winston Skills Engine — core types.
 *
 * A "skill" is a deterministic, reusable workflow that Winston can execute
 * on behalf of a dispensary operator. Unlike agent Q&A (which is open-ended),
 * skills have a fixed definition: declared parameters, required permissions,
 * step-by-step execution, and a structured output.
 *
 * Lifecycle:
 *   skill defined → registered → invoked → executed (step by step) → result
 */

import type { Permission, Role } from '../types/security';
import type { SqlContext } from '../db/types';

// ---- Skill definition -------------------------------------------------------

export type SkillCategory =
  | 'inventory'
  | 'compliance'
  | 'sales'
  | 'reporting'
  | 'operations';

/**
 * Declarative schema for a single skill parameter.
 * Mirrors a JSON-Schema property subset.
 */
export interface SkillParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'date';
  description: string;
  required?: boolean;
  default?: unknown;
}

/**
 * Full definition of a skill — the static metadata that describes what
 * the skill does, what it needs, and who is allowed to run it.
 */
export interface SkillDefinition {
  /** Stable, kebab-case identifier. Used as the API route segment. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** What this skill does. Shown to operators and the agent. */
  description: string;
  version: string;
  category: SkillCategory;
  /**
   * At least one of these permissions must be held by the caller's role.
   * The engine checks RBAC before executing.
   */
  requiredPermissions: Permission[];
  /** Input parameter schemas. */
  parameters: Record<string, SkillParameterSchema>;
}

// ---- Skill execution context ------------------------------------------------

/**
 * Runtime context passed to every skill invocation.
 * Includes the tenant-scoped DB connection and caller identity for audit.
 */
export interface SkillContext {
  tenantId: string;
  userId: string;
  role: Role;
  /**
   * Database connection with tenant RLS already applied.
   * All repository calls inside skills must use this connection.
   */
  sql: SqlContext;
}

// ---- Step tracking ----------------------------------------------------------

export type SkillStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface SkillStep {
  /** Internal step identifier (unique within the execution). */
  id: string;
  name: string;
  status: SkillStepStatus;
  startedAt?: string;   // ISO 8601
  completedAt?: string; // ISO 8601
  /** Structured output from this step (skill-specific shape). */
  output?: unknown;
  /** Error message if status is 'failed'. */
  error?: string;
}

// ---- Execution record -------------------------------------------------------

export type SkillStatus = 'pending' | 'running' | 'done' | 'failed';

/**
 * Complete execution record for a single skill run.
 * Written to the audit trail and returned to the caller.
 */
export interface SkillExecution {
  /** Unique execution ID (generated per run). */
  id: string;
  skillId: string;
  tenantId: string;
  userId: string;
  /** Parameters the skill was invoked with. */
  params: Record<string, unknown>;
  status: SkillStatus;
  steps: SkillStep[];
  /** Final structured output (set when status = 'done'). */
  output?: unknown;
  /** Top-level error message (set when status = 'failed'). */
  error?: string;
  startedAt: string;   // ISO 8601
  completedAt?: string; // ISO 8601
  /** Wall-clock duration of the full execution in milliseconds. */
  durationMs?: number;
}

// ---- Skill result -----------------------------------------------------------

/**
 * What the engine returns to callers.
 * Includes the execution record for audit traceability.
 */
export interface SkillResult {
  execution: SkillExecution;
  /** The skill's final structured output (mirrors execution.output). */
  output: unknown;
}
