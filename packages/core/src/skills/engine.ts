/**
 * Winston Skills Execution Engine.
 *
 * Orchestrates the end-to-end execution of a skill:
 *   1. Validate caller permissions (RBAC).
 *   2. Build a SkillExecution record.
 *   3. Run each step with retry logic on transient failures.
 *   4. Write a structured audit entry on every completion/failure.
 *   5. Return SkillResult.
 *
 * The engine is intentionally thin — it owns lifecycle management, not
 * business logic. Individual skills implement their own steps.
 */

import { randomUUID } from 'crypto';
import type {
  SkillContext,
  SkillDefinition,
  SkillExecution,
  SkillResult,
  SkillStep,
  SkillStepStatus,
} from './types';
import { hasPermission } from '../security/rbac/permissions';
import {
  buildAuditEntry,
  writeAuditEntry,
} from '../security/audit/logger';

/** Max retry attempts for a single step on transient failure. */
const MAX_STEP_RETRIES = 2;

/** Delay between step retries (ms). */
const RETRY_DELAY_MS = 500;

export class PermissionDeniedError extends Error {
  constructor(skillId: string, role: string) {
    super(`Role '${role}' is not permitted to run skill '${skillId}'`);
    this.name = 'PermissionDeniedError';
  }
}

export class SkillNotFoundError extends Error {
  constructor(skillId: string) {
    super(`Skill '${skillId}' is not registered`);
    this.name = 'SkillNotFoundError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function now(): string {
  return new Date().toISOString();
}

/**
 * The interface every skill handler must implement.
 * Skills are discovered via the SkillRegistry and executed by this engine.
 */
export interface SkillHandler {
  readonly definition: SkillDefinition;
  /**
   * Run the skill.
   *
   * Implementations should update the `steps` array in-place as they progress
   * so that callers can inspect partial state on failure.
   *
   * @param params  - Validated input parameters for this invocation.
   * @param ctx     - Tenant-scoped runtime context.
   * @param steps   - Mutable step array owned by the engine — update these.
   * @returns       The final structured output of the skill.
   */
  execute(
    params: Record<string, unknown>,
    ctx: SkillContext,
    steps: SkillStep[]
  ): Promise<unknown>;
}

// ---- Step helpers -----------------------------------------------------------

export function makeStep(id: string, name: string): SkillStep {
  return { id, name, status: 'pending' };
}

export function startStep(step: SkillStep): void {
  step.status = 'running';
  step.startedAt = now();
}

export function completeStep(step: SkillStep, output?: unknown): void {
  step.status = 'done';
  step.completedAt = now();
  step.output = output;
}

export function failStep(step: SkillStep, error: string): void {
  step.status = 'failed';
  step.completedAt = now();
  step.error = error;
}

/**
 * Run an async step function with retry on transient failures.
 * Updates the step object in-place.
 */
export async function runStep<T>(
  step: SkillStep,
  fn: () => Promise<T>,
  maxRetries = MAX_STEP_RETRIES
): Promise<T> {
  startStep(step);

  let lastError: Error = new Error('Unknown error');
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      completeStep(step, result);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  failStep(step, lastError.message);
  throw lastError;
}

// ---- Engine -----------------------------------------------------------------

export class SkillExecutionEngine {
  /**
   * Execute a skill by handler.
   *
   * @throws PermissionDeniedError  if the caller's role lacks required perms.
   */
  async run(
    handler: SkillHandler,
    params: Record<string, unknown>,
    ctx: SkillContext
  ): Promise<SkillResult> {
    const { definition } = handler;
    const startedAt = now();
    const executionId = randomUUID();

    // ── RBAC check ──────────────────────────────────────────────────────────
    const permitted = definition.requiredPermissions.some((p) =>
      hasPermission(ctx.role, p)
    );
    if (!permitted) {
      // Audit the denial
      writeAuditEntry(
        buildAuditEntry(
          { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role },
          `skill:${definition.id}`,
          'denied',
          { resourceType: 'skill', resourceId: definition.id }
        )
      );
      throw new PermissionDeniedError(definition.id, ctx.role);
    }

    // ── Build execution record ───────────────────────────────────────────────
    const steps: SkillStep[] = [];
    const execution: SkillExecution = {
      id: executionId,
      skillId: definition.id,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      params,
      status: 'running',
      steps,
      startedAt,
    };

    // ── Execute ──────────────────────────────────────────────────────────────
    let output: unknown;
    try {
      output = await handler.execute(params, ctx, steps);
      execution.status = 'done';
      execution.output = output;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      execution.status = 'failed';
      execution.error = message;
    }

    const completedAt = now();
    execution.completedAt = completedAt;
    execution.durationMs =
      new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // ── Audit trail ──────────────────────────────────────────────────────────
    writeAuditEntry(
      buildAuditEntry(
        { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role },
        `skill:${definition.id}`,
        execution.status === 'done' ? 'success' : 'error',
        {
          resourceType: 'skill',
          resourceId: definition.id,
          durationMs: execution.durationMs,
          errorMessage: execution.error,
        }
      )
    );

    if (execution.status === 'failed') {
      return { execution, output: null };
    }

    return { execution, output };
  }
}

/** Shared singleton engine. */
export const skillEngine = new SkillExecutionEngine();
