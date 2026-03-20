/**
 * Winston agent runtime.
 *
 * Wraps the Anthropic Claude API with an agentic tool-use loop. Each call to
 * `ask()` takes a natural language question, queries the appropriate data
 * sources via tools, and returns a structured answer with source attribution.
 *
 * Usage:
 *   const agent = new WinstonAgent();
 *   const response = await agent.ask(
 *     { question: "What's my top-selling product this week?" },
 *     { tenantId: 'tenant-123', sql }
 *   );
 *   console.log(response.answer);
 *   console.log(response.sources);  // ["POS sales data"]
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentQuery,
  AgentResponse,
  ToolInvocation,
} from './types';
import type { AgentContext } from './types';
import {
  TOOL_DEFINITIONS,
  TOOL_SOURCE_LABELS,
  executeTool,
} from './tools';
import {
  sessionMemory,
  newSessionId,
} from './memory';

// Max tool-use rounds before we stop looping (prevents infinite loops)
const MAX_TOOL_ROUNDS = 8;

const SYSTEM_PROMPT = `You are Winston, an AI operational assistant for cannabis retail dispensaries.

You have access to real-time dispensary data through a set of tools that query the POS system and METRC compliance records. Use these tools to answer the operator's questions accurately.

Guidelines:
- Always query real data via tools before answering — never guess at numbers.
- When multiple tools are relevant, call them in parallel if possible.
- Format answers clearly: use numbers, percentages, and lists where appropriate.
- If data is unavailable or a tool returns an error, say so honestly.
- For compliance questions (METRC), always cite the package label and lab testing state.
- Keep answers concise and actionable. Dispensary operators are busy.
- Today's date context is available in the user's question if they specify it; otherwise use the most recent period available.`;

export interface WinstonAgentConfig {
  /** Claude model to use. Defaults to claude-sonnet-4-6. */
  model?: string;
  /** Max tokens for the final response. Default 1024. */
  maxTokens?: number;
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
}

export class WinstonAgent {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: WinstonAgentConfig = {}) {
    this.client = new Anthropic({
      apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
    this.model = config.model ?? 'claude-sonnet-4-6';
    this.maxTokens = config.maxTokens ?? 1024;
  }

  /**
   * Answer a natural language question using live dispensary data.
   *
   * Runs the full agentic loop:
   *   1. Send question + session history to Claude with tool definitions.
   *   2. Execute any requested tool calls against the data repositories.
   *   3. Feed results back to Claude.
   *   4. Repeat until Claude produces a final text response.
   *   5. Return structured AgentResponse with answer + source attribution.
   */
  async ask(query: AgentQuery, ctx: AgentContext): Promise<AgentResponse> {
    const sessionId = query.sessionId ?? newSessionId();
    const history = sessionMemory.getHistory(sessionId);
    const toolInvocations: ToolInvocation[] = [];
    const sourcesSet = new Set<string>();

    // Build the opening user message
    const userMessage: Anthropic.MessageParam = {
      role: 'user',
      content: query.question,
    };

    // Messages for this turn (history + new user message)
    const messages: Anthropic.MessageParam[] = [...history, userMessage];

    let rounds = 0;
    let finalAnswer = '';

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
      });

      // Collect any text content
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text'
      );

      // Collect tool use requests
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        // Claude is done — capture the final text
        finalAnswer = textBlocks.map((b) => b.text).join('\n');

        // Append this assistant turn to messages (for memory persistence)
        messages.push({ role: 'assistant', content: response.content });
        break;
      }

      // Append the assistant's tool-use turn
      messages.push({ role: 'assistant', content: response.content });

      // Execute all requested tools in parallel
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const output = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            ctx
          );

          // Record for attribution
          toolInvocations.push({ tool: block.name, input: block.input as Record<string, unknown>, output });
          const label = TOOL_SOURCE_LABELS[block.name];
          if (label) sourcesSet.add(label);

          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify(output),
          };
        })
      );

      // Feed tool results back to Claude
      messages.push({ role: 'user', content: toolResults });
    }

    if (!finalAnswer) {
      finalAnswer =
        'I was unable to produce an answer within the allowed number of steps. ' +
        'Please try rephrasing your question.';
    }

    // Persist the completed turn (user question + assistant answer) to session
    sessionMemory.appendMessages(sessionId, [
      userMessage,
      { role: 'assistant', content: finalAnswer },
    ]);

    return {
      answer: finalAnswer,
      sources: Array.from(sourcesSet),
      toolInvocations,
      sessionId,
    };
  }
}

/** Shared singleton agent — suitable for single-process deployments. */
export const winstonAgent = new WinstonAgent();
