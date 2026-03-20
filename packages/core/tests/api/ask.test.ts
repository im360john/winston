/**
 * Integration tests for POST /api/v1/ask.
 *
 * We mock:
 *   - @anthropic-ai/sdk  (no real API calls)
 *   - ../../../src/db/client  (no real DB)
 *   - ../../../src/agent/runtime (winstonAgent.ask)
 *
 * We test the full request lifecycle: auth -> rate-limit -> validation ->
 * agent call -> response serialization.
 */

import { createApp } from '../../src/server';
import { createToken } from '../../src/security/auth/jwt';
import type { AgentResponse } from '../../src/agent/types';

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockAsk = jest.fn();

jest.mock('../../src/agent/runtime', () => ({
  winstonAgent: { ask: (...args: unknown[]) => mockAsk(...args) },
}));

jest.mock('../../src/db/client', () => ({
  withTenant: jest.fn(async (_tenantId: string, fn: (sql: unknown) => Promise<unknown>) => {
    // Provide a no-op sql function; the agent mock doesn't use it
    return fn(() => Promise.resolve([]));
  }),
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

const JWT_SECRET = 'a'.repeat(32);
const TENANT_ID = 'tenant-test-123';

function makeToken(overrides: Partial<{ tenantId: string; role: string }> = {}): string {
  return createToken({
    sub: 'user-1',
    tenantId: overrides.tenantId ?? TENANT_ID,
    role: (overrides.role as 'admin') ?? 'viewer',
  });
}

const MOCK_RESPONSE: AgentResponse = {
  answer: 'Your top seller this week is Blue Dream 1g with 88 units sold.',
  sources: ['POS sales data'],
  toolInvocations: [],
  sessionId: 'sess-abc',
};

// ── Setup ─────────────────────────────────────────────────────────────────────

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  process.env.WINSTON_JWT_SECRET = JWT_SECRET;
  app = createApp();
});

afterAll(() => {
  delete process.env.WINSTON_JWT_SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAsk.mockResolvedValue(MOCK_RESPONSE);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

// Use node's built-in http to avoid needing supertest as a dependency
import * as http from 'http';

async function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: unknown }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode!, body: JSON.parse(data) });
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

describe('POST /api/v1/ask', () => {
  test('returns 200 with AgentResponse for a valid authenticated request', async () => {
    const token = makeToken();
    const { status, body } = await post(
      '/api/v1/ask',
      { question: "What's my top-selling product this week?" },
      { Authorization: `Bearer ${token}` },
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      answer: expect.any(String),
      sources: expect.any(Array),
      sessionId: expect.any(String),
    });
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockAsk).toHaveBeenCalledWith(
      expect.objectContaining({ question: "What's my top-selling product this week?" }),
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
  });

  test('passes sessionId through when provided', async () => {
    const token = makeToken();
    await post(
      '/api/v1/ask',
      { question: 'How much did I make today?', sessionId: 'my-session' },
      { Authorization: `Bearer ${token}` },
    );

    expect(mockAsk).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'my-session' }),
      expect.anything(),
    );
  });

  test('returns 401 when Authorization header is missing', async () => {
    const { status, body } = await post('/api/v1/ask', { question: 'hello' });
    expect(status).toBe(401);
    expect(body).toHaveProperty('error');
    expect(mockAsk).not.toHaveBeenCalled();
  });

  test('returns 401 for an invalid JWT', async () => {
    const { status, body } = await post(
      '/api/v1/ask',
      { question: 'hello' },
      { Authorization: 'Bearer this.is.garbage' },
    );
    expect(status).toBe(401);
    expect(body).toHaveProperty('error');
    expect(mockAsk).not.toHaveBeenCalled();
  });

  test('returns 400 when question is missing', async () => {
    const token = makeToken();
    const { status, body } = await post(
      '/api/v1/ask',
      {},
      { Authorization: `Bearer ${token}` },
    );
    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/question/i);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  test('returns 400 when question is empty string', async () => {
    const token = makeToken();
    const { status, body } = await post(
      '/api/v1/ask',
      { question: '   ' },
      { Authorization: `Bearer ${token}` },
    );
    expect(status).toBe(400);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  test('returns 500 with safe message when agent throws', async () => {
    mockAsk.mockRejectedValue(new Error('Anthropic API timeout'));
    const token = makeToken();
    const { status, body } = await post(
      '/api/v1/ask',
      { question: 'How much revenue today?' },
      { Authorization: `Bearer ${token}` },
    );
    expect(status).toBe(500);
    expect((body as { error: string }).error).not.toContain('Anthropic');
    expect((body as { error: string }).error).toMatch(/internal error/i);
  });
});
