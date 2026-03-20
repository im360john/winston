/**
 * Integration tests for task management API endpoints.
 *
 * POST /api/v1/tasks  — create and queue a task
 * GET  /api/v1/tasks/:id — poll task status
 *
 * Uses Node's built-in http module (no external test dependencies).
 * Mocks db/client and agent/runtime.
 */

import * as http from 'http';
import { createApp } from '../../src/server';
import { createToken } from '../../src/security/auth/jwt';
import { taskStore } from '../../src/tasks/store';
import { stopTaskWorker } from '../../src/tasks/executor';

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('../../src/agent/runtime', () => ({
  winstonAgent: { ask: jest.fn() },
}));

jest.mock('../../src/db/client', () => ({
  withTenant: jest.fn(async (_tenantId: string, fn: (sql: unknown) => Promise<unknown>) => {
    return fn(() => Promise.resolve([]));
  }),
}));

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-task-test-00000001';
const JWT_SECRET = 'a'.repeat(32);

function makeToken(role: 'admin' | 'manager' | 'budtender' | 'viewer' = 'manager'): string {
  return createToken({ sub: 'user-1', tenantId: TENANT_ID, role });
}

async function httpPost(
  app: ReturnType<typeof createApp>,
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1', port, path, method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode!, body: JSON.parse(data) });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function httpGet(
  app: ReturnType<typeof createApp>,
  path: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'GET', headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode!, body: JSON.parse(data) });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  process.env.WINSTON_JWT_SECRET = JWT_SECRET;
  app = createApp();
});

afterAll(() => {
  delete process.env.WINSTON_JWT_SECRET;
  stopTaskWorker();
});

// ── POST /api/v1/tasks tests ──────────────────────────────────────────────────

describe('POST /api/v1/tasks', () => {
  it('returns 202 with task ID for a valid compliance-report request', async () => {
    const { status, body } = await httpPost(
      app,
      '/api/v1/tasks',
      { type: 'compliance-report' },
      { Authorization: `Bearer ${makeToken('manager')}` }
    );

    expect(status).toBe(202);
    const task = (body as { task: Record<string, unknown> }).task;
    expect(task.type).toBe('compliance-report');
    expect(task.status).toBe('pending');
    expect(typeof task.id).toBe('string');
    expect(String(task.statusUrl)).toContain(task.id);
  });

  it('returns 202 for restock-recommendation', async () => {
    const { status, body } = await httpPost(
      app,
      '/api/v1/tasks',
      { type: 'restock-recommendation' },
      { Authorization: `Bearer ${makeToken('manager')}` }
    );

    expect(status).toBe(202);
    const task = (body as { task: Record<string, unknown> }).task;
    expect(task.type).toBe('restock-recommendation');
  });

  it('returns 202 with high priority', async () => {
    const { status, body } = await httpPost(
      app,
      '/api/v1/tasks',
      { type: 'compliance-report', priority: 'high' },
      { Authorization: `Bearer ${makeToken('admin')}` }
    );

    expect(status).toBe(202);
    const task = (body as { task: Record<string, unknown> }).task;
    expect(task.priority).toBe('high');
  });

  it('returns 400 for an invalid task type', async () => {
    const { status, body } = await httpPost(
      app,
      '/api/v1/tasks',
      { type: 'teleport-bananas' },
      { Authorization: `Bearer ${makeToken('admin')}` }
    );

    expect(status).toBe(400);
    expect(String((body as { error: string }).error).toLowerCase()).toMatch(/invalid.*task type/);
  });

  it('returns 400 for an invalid priority', async () => {
    const { status, body } = await httpPost(
      app,
      '/api/v1/tasks',
      { type: 'compliance-report', priority: 'urgent' },
      { Authorization: `Bearer ${makeToken('admin')}` }
    );

    expect(status).toBe(400);
    expect(String((body as { error: string }).error).toLowerCase()).toMatch(/invalid priority/);
  });

  it('returns 400 when params is an array', async () => {
    const { status, body } = await httpPost(
      app,
      '/api/v1/tasks',
      { type: 'compliance-report', params: ['bad'] },
      { Authorization: `Bearer ${makeToken('admin')}` }
    );

    expect(status).toBe(400);
    expect(String((body as { error: string }).error).toLowerCase()).toMatch(/plain object/);
  });

  it('returns 403 when role lacks required permission (budtender cannot run compliance-report)', async () => {
    const { status, body } = await httpPost(
      app,
      '/api/v1/tasks',
      { type: 'compliance-report' },
      { Authorization: `Bearer ${makeToken('budtender')}` }
    );

    expect(status).toBe(403);
    expect(String((body as { error: string }).error).toLowerCase()).toMatch(/not permitted/);
  });

  it('returns 401 without a token', async () => {
    const { status } = await httpPost(app, '/api/v1/tasks', { type: 'compliance-report' });
    expect(status).toBe(401);
  });
});

// ── GET /api/v1/tasks/:id tests ───────────────────────────────────────────────

describe('GET /api/v1/tasks/:id', () => {
  it('returns the task by ID for the correct tenant', async () => {
    const task = taskStore.create({
      tenantId: TENANT_ID,
      userId: 'user-1',
      role: 'manager',
      type: 'compliance-report',
      priority: 'normal',
      params: {},
    });

    const { status, body } = await httpGet(
      app,
      `/api/v1/tasks/${task.id}`,
      { Authorization: `Bearer ${makeToken('manager')}` }
    );

    expect(status).toBe(200);
    const returned = (body as { task: Record<string, unknown> }).task;
    expect(returned.id).toBe(task.id);
    expect(returned.type).toBe('compliance-report');
  });

  it('returns 404 for an unknown task ID', async () => {
    const { status } = await httpGet(
      app,
      '/api/v1/tasks/00000000-0000-0000-0000-000000000000',
      { Authorization: `Bearer ${makeToken('manager')}` }
    );

    expect(status).toBe(404);
  });

  it('returns 404 when task belongs to a different tenant', async () => {
    const task = taskStore.create({
      tenantId: TENANT_ID,
      userId: 'user-1',
      role: 'manager',
      type: 'restock-recommendation',
      priority: 'normal',
      params: {},
    });

    const otherToken = createToken({
      sub: 'user-other',
      tenantId: 'different-tenant-000000001',
      role: 'admin',
    });

    const { status } = await httpGet(
      app,
      `/api/v1/tasks/${task.id}`,
      { Authorization: `Bearer ${otherToken}` }
    );

    expect(status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const { status } = await httpGet(app, '/api/v1/tasks/some-id');
    expect(status).toBe(401);
  });

  it('reflects completed status in the response', async () => {
    const task = taskStore.create({
      tenantId: TENANT_ID,
      userId: 'user-1',
      role: 'manager',
      type: 'restock-recommendation',
      priority: 'normal',
      params: {},
    });

    taskStore.markRunning(task.id);
    taskStore.markCompleted(task.id, { totalAlertsCount: 2 }, []);

    const { status, body } = await httpGet(
      app,
      `/api/v1/tasks/${task.id}`,
      { Authorization: `Bearer ${makeToken('manager')}` }
    );

    expect(status).toBe(200);
    const returned = (body as { task: Record<string, unknown> }).task;
    expect(returned.status).toBe('completed');
    expect((returned.output as { totalAlertsCount: number }).totalAlertsCount).toBe(2);
  });
});
