/**
 * Winston API router — v1.
 *
 * Mounts:
 *   POST /api/v1/ask  — natural language Q&A over dispensary data
 *
 * Security stack (applied per-route):
 *   audit -> auth -> tenant -> rbac('sales:read')
 *
 * The minimum required role is 'viewer' (has sales:read). Any authenticated
 * dispensary user can call the agent endpoint.
 */

import { Router, Request, Response } from 'express';
import { securityStack, rbacMiddleware } from '../security';
import { winstonAgent } from '../agent/runtime';
import { withTenant } from '../db/client';
import { tenantRateLimiter } from './rate-limit';
import type { AgentQuery } from '../agent/types';

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
