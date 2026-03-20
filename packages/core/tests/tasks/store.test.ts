/**
 * Unit tests for TaskStore.
 */

import { TaskStore } from '../../src/tasks/store';
import type { WinstonTask } from '../../src/tasks/types';

const TENANT_A = 'tenant-a-0000-0000-0000-000000000001';
const TENANT_B = 'tenant-b-0000-0000-0000-000000000002';

function makeStore(): TaskStore {
  return new TaskStore();
}

function createTask(
  store: TaskStore,
  overrides: Partial<{
    tenantId: string;
    type: WinstonTask['type'];
    priority: WinstonTask['priority'];
  }> = {}
): WinstonTask {
  return store.create({
    tenantId: overrides.tenantId ?? TENANT_A,
    userId: 'user-1',
    role: 'manager',
    type: overrides.type ?? 'compliance-report',
    priority: overrides.priority ?? 'normal',
    params: {},
  });
}

describe('TaskStore', () => {
  describe('create()', () => {
    it('creates a task with pending status', () => {
      const store = makeStore();
      const task = createTask(store);
      expect(task.status).toBe('pending');
      expect(task.id).toBeTruthy();
      expect(task.output).toBeNull();
      expect(task.error).toBeNull();
      expect(task.steps).toEqual([]);
      expect(task.startedAt).toBeNull();
      expect(task.completedAt).toBeNull();
    });

    it('assigns a unique UUID per task', () => {
      const store = makeStore();
      const a = createTask(store);
      const b = createTask(store);
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('get() and getForTenant()', () => {
    it('get() returns the task by ID', () => {
      const store = makeStore();
      const task = createTask(store);
      expect(store.get(task.id)).toBe(task);
    });

    it('get() returns undefined for unknown IDs', () => {
      const store = makeStore();
      expect(store.get('nonexistent')).toBeUndefined();
    });

    it('getForTenant() returns task for matching tenant', () => {
      const store = makeStore();
      const task = createTask(store, { tenantId: TENANT_A });
      expect(store.getForTenant(task.id, TENANT_A)).toBe(task);
    });

    it('getForTenant() returns undefined for a different tenant', () => {
      const store = makeStore();
      const task = createTask(store, { tenantId: TENANT_A });
      expect(store.getForTenant(task.id, TENANT_B)).toBeUndefined();
    });
  });

  describe('nextPending()', () => {
    it('returns undefined when there are no tasks', () => {
      const store = makeStore();
      expect(store.nextPending()).toBeUndefined();
    });

    it('returns the single pending task', () => {
      const store = makeStore();
      const task = createTask(store);
      expect(store.nextPending()).toBe(task);
    });

    it('prefers critical over normal priority', () => {
      const store = makeStore();
      const normal = createTask(store, { priority: 'normal' });
      const critical = createTask(store, { priority: 'critical' });
      expect(store.nextPending()).toBe(critical);
      // Suppress unused warning
      expect(normal).toBeDefined();
    });

    it('breaks ties by createdAt (earliest first)', () => {
      const store = makeStore();
      const first = createTask(store, { priority: 'normal' });
      // Ensure different createdAt by slightly mutating
      const second = createTask(store, { priority: 'normal' });
      // first was created earlier
      expect(store.nextPending()!.id).toBe(first.id);
      expect(second).toBeDefined();
    });

    it('skips non-pending tasks', () => {
      const store = makeStore();
      const task = createTask(store);
      store.markRunning(task.id);
      expect(store.nextPending()).toBeUndefined();
    });
  });

  describe('status transitions', () => {
    it('markRunning() sets status to running and startedAt', () => {
      const store = makeStore();
      const task = createTask(store);
      store.markRunning(task.id);
      expect(task.status).toBe('running');
      expect(task.startedAt).not.toBeNull();
    });

    it('markCompleted() sets status, output, steps, completedAt', () => {
      const store = makeStore();
      const task = createTask(store);
      store.markRunning(task.id);
      const output = { foo: 'bar' };
      const steps = [{ id: 's1', name: 'Step 1', status: 'done' as const }];
      store.markCompleted(task.id, output, steps);
      expect(task.status).toBe('completed');
      expect(task.output).toEqual(output);
      expect(task.steps).toEqual(steps);
      expect(task.completedAt).not.toBeNull();
    });

    it('markFailed() sets status, error, steps, completedAt', () => {
      const store = makeStore();
      const task = createTask(store);
      store.markRunning(task.id);
      store.markFailed(task.id, 'something went wrong', []);
      expect(task.status).toBe('failed');
      expect(task.error).toBe('something went wrong');
      expect(task.completedAt).not.toBeNull();
    });
  });

  describe('tenant isolation', () => {
    it('listForTenant() only returns tasks for the given tenant', () => {
      const store = makeStore();
      createTask(store, { tenantId: TENANT_A });
      createTask(store, { tenantId: TENANT_A });
      createTask(store, { tenantId: TENANT_B });
      expect(store.listForTenant(TENANT_A)).toHaveLength(2);
      expect(store.listForTenant(TENANT_B)).toHaveLength(1);
    });
  });
});
