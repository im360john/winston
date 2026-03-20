/**
 * Winston API router — v1.
 *
 * Mounts:
 *   POST /api/v1/ask              — natural language Q&A over dispensary data
 *   GET  /api/v1/skills           — list available skills
 *   POST /api/v1/skills/:id/run   — run a skill by ID
 *
 * Security stack (applied per-route):
 *   audit -> auth -> tenant -> rbac(<permission>)
 */

import { Router, Request, Response } from 'express';
import { securityStack, rbacMiddleware } from '../security';
import { winstonAgent } from '../agent/runtime';
import { withTenant } from '../db/client';
import { tenantRateLimiter } from './rate-limit';
import type { AgentQuery } from '../agent/types';
import '../skills'; // register built-in skills as side effect
import { skillRegistry, skillEngine, SkillNotFoundError, PermissionDeniedError } from '../skills';
import type { SkillContext } from '../skills';
import '../tasks'; // register task handlers + start background worker as side effect
import { taskStore, getTaskHandler, VALID_TASK_TYPES, VALID_PRIORITIES } from '../tasks';
import type { TaskType, TaskPriority } from '../tasks';
import { hasPermission } from '../security/rbac/permissions';

export const apiRouter = Router();

// ── POST /api/v1/ask ─────────────────────────────────────────────────────────

apiRouter.post(
  '/ask',
  ...securityStack,
  rbacMiddleware('sales:read'),
  async (req: Request, res: Response): Promise<void> => {
    const ctx = req.tenantContext!;
    const tenantId = ctx.tenantId;

    // Rate limit: 30 req/min per tenant
    if (!tenantRateLimiter.isAllowed(tenantId)) {
      const retryAfter = tenantRateLimiter.retryAfterSeconds(tenantId);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Rate limit exceeded — max 30 requests per minute per tenant',
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    const { question, sessionId } = req.body as {
      question?: unknown;
      sessionId?: unknown;
    };

    if (!question || typeof question !== 'string' || question.trim() === '') {
      res.status(400).json({ error: 'Missing or empty required field: question' });
      return;
    }

    const query: AgentQuery = {
      question: question.trim(),
      ...(typeof sessionId === 'string' && sessionId ? { sessionId } : {}),
    };

    try {
      const agentResponse = await withTenant(tenantId, async (sql) => {
        return winstonAgent.ask(query, { tenantId, sql });
      });

      res.status(200).json(agentResponse);
    } catch (err) {
      // Never leak internal error details to clients
      const message =
        err instanceof Error ? err.message : 'Unknown error';
      // Log full error server-side (audit middleware logs HTTP outcome)
      console.error('[winston/ask] agent error:', message, err);

      res.status(500).json({ error: 'Agent encountered an internal error. Please try again.' });
    }
  },
);

// ── GET /api/v1/skills ────────────────────────────────────────────────────────
// List all registered skills. Minimum role: viewer (inventory:read is widest
// common permission — skills also enforce their own RBAC at execution time).

apiRouter.get(
  '/skills',
  ...securityStack,
  rbacMiddleware('inventory:read'),
  (_req: Request, res: Response): void => {
    res.status(200).json({ skills: skillRegistry.list() });
  },
);

// ── POST /api/v1/skills/:id/run ───────────────────────────────────────────────
// Execute a skill by ID. RBAC is enforced inside the engine per skill definition.

// ── POST /api/v1/tasks ────────────────────────────────────────────────────────
// Create and queue an async task. Returns 202 Accepted with the task ID.

apiRouter.post(
  '/tasks',
  ...securityStack,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = req.tenantContext!;

    if (!tenantRateLimiter.isAllowed(ctx.tenantId)) {
      const retryAfter = tenantRateLimiter.retryAfterSeconds(ctx.tenantId);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Rate limit exceeded — max 30 requests per minute per tenant',
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    const body = req.body as { type?: unknown; priority?: unknown; params?: unknown };
    const { type, priority = 'normal', params = {} } = body;

    if (!type || typeof type !== 'string' || !(VALID_TASK_TYPES as readonly string[]).includes(type)) {
      res.status(400).json({
        error: `Invalid or missing task type. Valid types: ${VALID_TASK_TYPES.join(', ')}`,
      });
      return;
    }

    if (typeof priority !== 'string' || !(VALID_PRIORITIES as readonly string[]).includes(priority)) {
      res.status(400).json({
        error: `Invalid priority. Valid values: ${VALID_PRIORITIES.join(', ')}`,
      });
      return;
    }

    if (typeof params !== 'object' || params === null || Array.isArray(params)) {
      res.status(400).json({ error: 'params must be a plain object' });
      return;
    }

    const handler = getTaskHandler(type as TaskType);
    if (!handler) {
      res.status(400).json({ error: `Task type '${type}' is not available` });
      return;
    }

    // RBAC: caller must hold at least one of the task's required permissions.
    const permitted = handler.requiredPermissions.some((p) =>
      hasPermission(ctx.role, p)
    );
    if (!permitted) {
      res.status(403).json({
        error: `Role '${ctx.role}' is not permitted to create '${type}' tasks`,
      });
      return;
    }

    const task = taskStore.create({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      role: ctx.role,
      type: type as TaskType,
      priority: priority as TaskPriority,
      params: params as Record<string, unknown>,
    });

    res.status(202).json({
      task: {
        id: task.id,
        type: task.type,
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt,
        statusUrl: `/api/v1/tasks/${task.id}`,
      },
    });
  },
);

// ── GET /api/v1/tasks/:id ─────────────────────────────────────────────────────
// Poll task status. Returns the full task record including output when done.

apiRouter.get(
  '/tasks/:id',
  ...securityStack,
  rbacMiddleware('reports:read'),
  (req: Request, res: Response): void => {
    const ctx = req.tenantContext!;
    const taskId = req.params.id;

    const task = taskStore.getForTenant(taskId, ctx.tenantId);
    if (!task) {
      res.status(404).json({ error: `Task '${taskId}' not found` });
      return;
    }

    res.status(200).json({ task });
  },
);

// ── POST /api/v1/skills/:id/run ───────────────────────────────────────────────
// Execute a skill by ID. RBAC is enforced inside the engine per skill definition.

apiRouter.post(
  '/skills/:id/run',
  ...securityStack,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = req.tenantContext!;
    const skillId = req.params.id;

    // Rate limit shared with ask endpoint
    if (!tenantRateLimiter.isAllowed(ctx.tenantId)) {
      const retryAfter = tenantRateLimiter.retryAfterSeconds(ctx.tenantId);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Rate limit exceeded — max 30 requests per minute per tenant',
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    const handler = skillRegistry.get(skillId);
    if (!handler) {
      res.status(404).json({ error: `Skill '${skillId}' not found` });
      return;
    }

    const params = (req.body as Record<string, unknown>) ?? {};

    try {
      const result = await withTenant(ctx.tenantId, async (sql) => {
        const skillCtx: SkillContext = {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          role: ctx.role,
          sql,
        };
        return skillEngine.run(handler, params, skillCtx);
      });

      const statusCode = result.execution.status === 'done' ? 200 : 500;
      res.status(statusCode).json(result);
    } catch (err) {
      if (err instanceof PermissionDeniedError) {
        res.status(403).json({ error: err.message });
        return;
      }
      if (err instanceof SkillNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[winston/skills/${skillId}] error:`, message, err);
      res.status(500).json({ error: 'Skill encountered an internal error. Please try again.' });
    }
  },
);
