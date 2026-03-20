/**
 * Winston Task Management — core types.
 *
 * A "task" is an async, durable unit of work that Winston executes on behalf
 * of a dispensary operator. Unlike skills (which are synchronous), tasks are
 * queued and executed in the background — the caller gets an ID immediately
 * and polls for completion.
 *
 * Lifecycle:
 *   POST /api/v1/tasks → pending → running → completed | failed
 */

import type { Permission, Role } from '../types/security';
import type { SqlContext } from '../db/types';

// ---- Task types -------------------------------------------------------------

export type TaskType =
  | 'compliance-report'
  | 'restock-recommendation'
  | 'customer-segment-analysis';

export const VALID_TASK_TYPES: readonly TaskType[] = [
  'compliance-report',
  'restock-recommendation',
  'customer-segment-analysis',
];

// ---- Status & priority ------------------------------------------------------

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export const VALID_PRIORITIES: readonly TaskPriority[] = ['low', 'normal', 'high', 'critical'];

/** Lower number = higher priority. Used for queue ordering. */
export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ---- Step tracking ----------------------------------------------------------

export interface TaskStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
}

// ---- Task record ------------------------------------------------------------

/**
 * Full in-memory representation of a single task.
 * Tenant isolation is enforced at every read path.
 */
export interface WinstonTask {
  id: string;
  tenantId: string;
  userId: string;
  role: Role;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  /** Input parameters supplied by the caller. */
  params: Record<string, unknown>;
  /** Structured output when status = 'completed'. */
  output: unknown | null;
  /** Error message when status = 'failed'. Never contains internal stack traces. */
  error: string | null;
  /** Step-level audit trail of execution progress. */
  steps: TaskStep[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

// ---- Execution context ------------------------------------------------------

/**
 * Runtime context passed to every task handler.
 * Mirrors SkillContext — tenant-scoped DB connection + caller identity.
 */
export interface TaskContext {
  tenantId: string;
  userId: string;
  role: Role;
  /** DB connection with tenant RLS applied. */
  sql: SqlContext;
}

// ---- Handler interface ------------------------------------------------------

/**
 * Interface that every task handler must implement.
 * Register handlers with registerTaskHandler() in src/tasks/index.ts.
 */
export interface TaskHandler {
  readonly type: TaskType;
  /** At least one of these permissions must be held by the caller's role. */
  readonly requiredPermissions: Permission[];
  /**
   * Execute the task.
   *
   * @param params  Input parameters (already validated at the API layer).
   * @param ctx     Tenant-scoped runtime context.
   * @param steps   Mutable step array — append steps to track progress.
   * @returns       The final structured output.
   */
  execute(
    params: Record<string, unknown>,
    ctx: TaskContext,
    steps: TaskStep[]
  ): Promise<unknown>;
}

// ---- API input --------------------------------------------------------------

export interface CreateTaskInput {
  type: TaskType;
  priority?: TaskPriority;
  params?: Record<string, unknown>;
}
