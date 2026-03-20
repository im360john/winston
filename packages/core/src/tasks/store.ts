/**
 * Winston Task Store.
 *
 * In-memory store for all task state. Provides:
 *   - CRUD operations with tenant isolation at every read
 *   - Priority-ordered next-pending selection for the background worker
 *   - Safe mutation helpers (markRunning, markCompleted, markFailed)
 *
 * The store is intentionally simple: a Map keyed by task ID. The background
 * executor is the only writer of status transitions; the HTTP layer only reads
 * and creates. No locking is needed because Node.js is single-threaded.
 */

import { randomUUID } from 'crypto';
import type { WinstonTask, TaskType, TaskPriority, TaskStep } from './types';
import { PRIORITY_ORDER } from './types';
import type { Role } from '../types/security';

export class TaskStore {
  private readonly tasks = new Map<string, WinstonTask>();

  /**
   * Create a new task in 'pending' status and add it to the store.
   * Returns the full task record.
   */
  create(opts: {
    tenantId: string;
    userId: string;
    role: Role;
    type: TaskType;
    priority: TaskPriority;
    params: Record<string, unknown>;
  }): WinstonTask {
    const task: WinstonTask = {
      id: randomUUID(),
      tenantId: opts.tenantId,
      userId: opts.userId,
      role: opts.role,
      type: opts.type,
      priority: opts.priority,
      status: 'pending',
      params: opts.params,
      output: null,
      error: null,
      steps: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * Retrieve a task by ID.
   * Does NOT enforce tenant isolation — use getForTenant() in HTTP handlers.
   */
  get(id: string): WinstonTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Retrieve a task by ID scoped to a tenant.
   * Returns undefined if the task does not exist or belongs to a different tenant.
   */
  getForTenant(id: string, tenantId: string): WinstonTask | undefined {
    const task = this.tasks.get(id);
    if (!task || task.tenantId !== tenantId) return undefined;
    return task;
  }

  /**
   * Return the next task to execute: highest priority pending task,
   * with ties broken by earliest createdAt.
   */
  nextPending(): WinstonTask | undefined {
    let best: WinstonTask | undefined;
    for (const task of this.tasks.values()) {
      if (task.status !== 'pending') continue;
      if (
        !best ||
        PRIORITY_ORDER[task.priority] < PRIORITY_ORDER[best.priority] ||
        (PRIORITY_ORDER[task.priority] === PRIORITY_ORDER[best.priority] &&
          task.createdAt < best.createdAt)
      ) {
        best = task;
      }
    }
    return best;
  }

  /** Transition a task from pending → running. */
  markRunning(id: string): void {
    const task = this.tasks.get(id);
    if (task && task.status === 'pending') {
      task.status = 'running';
      task.startedAt = new Date().toISOString();
    }
  }

  /** Transition a task to completed with its output and step audit trail. */
  markCompleted(id: string, output: unknown, steps: TaskStep[]): void {
    const task = this.tasks.get(id);
    if (task && task.status === 'running') {
      task.status = 'completed';
      task.output = output;
      task.steps = steps;
      task.completedAt = new Date().toISOString();
    }
  }

  /** Transition a task to failed with an error message and step audit trail. */
  markFailed(id: string, error: string, steps: TaskStep[]): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'failed';
      task.error = error;
      task.steps = steps;
      task.completedAt = new Date().toISOString();
    }
  }

  /** Return the total number of tasks in the store (all statuses). */
  size(): number {
    return this.tasks.size;
  }

  /** Return all tasks for a tenant (for testing / admin use). */
  listForTenant(tenantId: string): WinstonTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.tenantId === tenantId);
  }
}

/** Shared singleton store. */
export const taskStore = new TaskStore();
