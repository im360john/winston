/**
 * Session memory for Winston agent conversations.
 *
 * Stores message history per session in memory. Each session is a sliding
 * window of the last N turns — enough for coherent multi-turn Q&A without
 * unbounded growth.
 *
 * Designed to be replaced with a DB-backed store (Redis / Postgres) once
 * multi-instance deployment is needed. The interface is the same either way.
 */

import type Anthropic from '@anthropic-ai/sdk';

type MessageParam = Anthropic.MessageParam;

const MAX_TURNS_PER_SESSION = 20;

/** Opaque session identifier. */
export type SessionId = string;

/** Minimal in-process session store. */
export class SessionMemory {
  private readonly store = new Map<SessionId, MessageParam[]>();

  /** Retrieve message history for a session (empty array if new). */
  getHistory(sessionId: SessionId): MessageParam[] {
    return this.store.get(sessionId) ?? [];
  }

  /** Append new messages and trim to MAX_TURNS_PER_SESSION. */
  appendMessages(sessionId: SessionId, messages: MessageParam[]): void {
    const existing = this.store.get(sessionId) ?? [];
    const updated = [...existing, ...messages];
    // Keep the most recent turns (always keep pairs: user + assistant)
    const trimmed =
      updated.length > MAX_TURNS_PER_SESSION
        ? updated.slice(updated.length - MAX_TURNS_PER_SESSION)
        : updated;
    this.store.set(sessionId, trimmed);
  }

  /** Remove a session entirely (e.g. on logout or explicit reset). */
  clearSession(sessionId: SessionId): void {
    this.store.delete(sessionId);
  }

  /** Number of active sessions (for health checks / metrics). */
  get sessionCount(): number {
    return this.store.size;
  }
}

/** Shared singleton — suitable for single-process deployments. */
export const sessionMemory = new SessionMemory();

/** Generate a random session ID. */
export function newSessionId(): SessionId {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
