/**
 * Winston agent runtime types.
 *
 * AgentContext carries everything the agent needs to execute tools for a
 * specific tenant. AgentQuery is the inbound request. AgentResponse is the
 * structured output with source attribution.
 */

import type { SqlContext } from '../db/types';

// ---- Context ----------------------------------------------------------------

/**
 * Runtime context injected into each agent session.
 * sql must already be scoped to the correct tenant (RLS set_config applied).
 */
export interface AgentContext {
  /** Winston tenant identifier — used for tool attribution and audit. */
  tenantId: string;
  /**
   * Database connection with tenant RLS already applied.
   * Required for all data-repository tools.
   */
  sql: SqlContext;
}

// ---- Query ------------------------------------------------------------------

export interface AgentQuery {
  /** The natural language question from the dispensary operator. */
  question: string;
  /**
   * Optional conversation session ID for memory continuity.
   * Omit to start a fresh session.
   */
  sessionId?: string;
}

// ---- Response ---------------------------------------------------------------

/** One tool invocation captured for source attribution. */
export interface ToolInvocation {
  /** Tool name as defined in the Anthropic tools list. */
  tool: string;
  /** Input passed to the tool. */
  input: Record<string, unknown>;
  /** Raw result returned by the tool executor. */
  output: unknown;
}

export interface AgentResponse {
  /** The agent's natural language answer to the question. */
  answer: string;
  /**
   * Human-readable source labels (e.g. "POS sales data", "METRC packages").
   * Derived from tools actually called during this response.
   */
  sources: string[];
  /** Full trace of every tool call made during this session turn. */
  toolInvocations: ToolInvocation[];
  /** Session ID — pass back in AgentQuery.sessionId to continue the conversation. */
  sessionId: string;
}
