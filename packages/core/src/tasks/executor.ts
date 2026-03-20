/**
 * Winston Task Executor.
 *
 * Manages the registry of task handlers and the background worker loop.
 *
 * Architecture:
 *   - registerTaskHandler()  — called at startup to declare supported types.
 *   - startTaskWorker()      — starts the background processing loop.
 *   - processNext()          — picks the highest-priority pending task,
 *                              executes it, and updates the store.
 *
 * The worker is a simple setTimeout-based loop. Node.js is single-threaded,
 * so there are no race conditions in queue selection or store mutation.
 * One task runs at a time; the worker waits for completion before picking
 * the next (WORKER_INTERVAL_MS cooldown between ticks).
 *
 * Tenant isolation: tasks carry their tenantId; withTenant() sets the RLS
 * context before the handler runs, so all DB queries are automatically scoped.
 */

import { taskStore } from './store';
import type { TaskHandler, TaskStep } from './types';
import type { TaskType } from './types';
import { withTenant } from '../db/client';
import { buildAuditEntry, writeAuditEntry } from '../security/audit/logger';

/** Milliseconds between worker ticks when the queue is idle. */
const WORKER_INTERVAL_MS = 200;

// ---- Handler registry -------------------------------------------------------

const handlers = new Map<TaskType, TaskHandler>();

/**
 * Register a task handler.
 * Throws if a handler for the same type is already registered.
 * Called at startup by src/tasks/index.ts.
 */
export function registerTaskHandler(handler: TaskHandler): void {
  if (handlers.has(handler.type)) {
    throw new Error(`Task handler for '${handler.type}' is already registered`);
  }
  handlers.set(handler.type, handler);
}

/** Return a registered handler by task type, or undefined. */
export function getTaskHandler(type: TaskType): TaskHandler | undefined {
  return handlers.get(type);
}

/** Return all registered handlers (for inspection / docs). */
export function listTaskHandlers(): TaskHandler[] {
  return Array.from(handlers.values());
}

// ---- Background worker ------------------------------------------------------

let workerTimer: ReturnType<typeof setTimeout> | null = null;
let isProcessing = false;

/**
 * Execute the next pending task.
 * No-ops if already processing or if the queue is empty.
 */
async function processNext(): Promise<void> {
  if (isProcessing) return;

  const task = taskStore.nextPending();
  if (!task) return;

  const handler = handlers.get(task.type);
  if (!handler) {
    // Unknown type — fail immediately without retrying.
    taskStore.markFailed(
      task.id,
      `No handler registered for task type '${task.type}'`,
      []
    );
    return;
  }

  isProcessing = true;
  taskStore.markRunning(task.id);

  const steps: TaskStep[] = [];

  try {
    const output = await withTenant(task.tenantId, (sql) =>
      handler.execute(task.params, { tenantId: task.tenantId, userId: task.userId, role: task.role, sql }, steps)
    );

    taskStore.markCompleted(task.id, output, steps);

    writeAuditEntry(
      buildAuditEntry(
        { tenantId: task.tenantId, userId: task.userId, role: task.role },
        `task:${task.type}`,
        'success',
        { resourceType: 'task', resourceId: task.id }
      )
    );
  } catch (err) {
    // Sanitize: never surface internal stack traces to the task record.
    const message =
      err instanceof Error ? err.message : 'Task execution failed due to an internal error';

    taskStore.markFailed(task.id, message, steps);

    writeAuditEntry(
      buildAuditEntry(
        { tenantId: task.tenantId, userId: task.userId, role: task.role },
        `task:${task.type}`,
        'error',
        { resourceType: 'task', resourceId: task.id, errorMessage: message }
      )
    );
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the background task worker.
 * Idempotent — safe to call multiple times; only the first call starts the loop.
 */
export function startTaskWorker(): void {
  if (workerTimer !== null) return;

  const tick = (): void => {
    processNext()
      .catch((err) => {
        console.error('[task-worker] unexpected error in processNext:', err);
      })
      .finally(() => {
        // .unref() ensures the timer does not prevent the Node process from
        // exiting when there is no other work to do (e.g., during tests).
        workerTimer = setTimeout(tick, WORKER_INTERVAL_MS);
        workerTimer.unref();
      });
  };

  workerTimer = setTimeout(tick, WORKER_INTERVAL_MS);
  workerTimer.unref();
}

/**
 * Stop the background task worker.
 * Used in tests to prevent timer leaks.
 */
export function stopTaskWorker(): void {
  if (workerTimer !== null) {
    clearTimeout(workerTimer);
    workerTimer = null;
  }
}
