import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OutboxService, OutboxOperation } from '../OutboxService';
import { IndexedDBAdapter, IDB_CONFIG } from '../../repositories/IndexedDBAdapter';

describe('OutboxService', () => {
  beforeEach(async () => {
    OutboxService.setExecutor(null);
    await OutboxService.clearPending();
  });

  afterEach(async () => {
    OutboxService.setExecutor(null);
    await OutboxService.clearPending();
  });

  describe('Enqueue & Persistence', () => {
    it('enqueues an operation with unique ID and initial attempts = 0', async () => {
      // Mock an executor that succeeds so the auto-flush doesn't drain immediately or we can check IndexedDB
      OutboxService.setExecutor(async () => true);

      const op = await OutboxService.enqueue({
        entity: 'transaction',
        action: 'create',
        payload: { id: 'tx_123', amount: 500 },
        userId: 'user_test_1'
      });

      expect(op.id).toBeDefined();
      expect(op.entity).toBe('transaction');
      expect(op.action).toBe('create');
      expect(op.userId).toBe('user_test_1');
      expect(op.payload).toEqual({ id: 'tx_123', amount: 500 });
      expect(op.attempts).toBe(0);
      expect(op.timestamp).toBeGreaterThan(0);
    });

    it('retrieves operations in FIFO causal order', async () => {
      // Mock an executor that holds operations (returns false)
      OutboxService.setExecutor(async () => false);

      // Create two operations with different timestamps
      const op1 = await OutboxService.enqueue({
        entity: 'card',
        action: 'create',
        payload: { id: 'card_1', name: 'Visa' },
        userId: 'user_test_1'
      });

      // Small delay to ensure timestamp progression
      await new Promise(r => setTimeout(r, 10));

      const op2 = await OutboxService.enqueue({
        entity: 'card',
        action: 'update',
        payload: { id: 'card_1', name: 'Visa Gold' },
        userId: 'user_test_1'
      });

      expect(op1.id).toBeDefined();
      expect(op2.id).toBeDefined();
      const pending = await OutboxService.getPending();
      expect(pending.length).toBe(2);
      expect(pending[0].action).toBe('create');
      expect(pending[1].action).toBe('update');
      expect(pending[0].timestamp).toBeLessThanOrEqual(pending[1].timestamp);
    });
  });

  describe('Flush & Drain Engine', () => {
    it('successfully processes and deletes operations on executor success', async () => {
      const processed: string[] = [];
      OutboxService.setExecutor(async (op: OutboxOperation) => {
        processed.push(op.id);
        return true;
      });

      await IndexedDBAdapter.put(IDB_CONFIG.stores.OUTBOX, {
        id: 'op_1',
        userId: 'u1',
        entity: 'transaction',
        action: 'create',
        payload: { id: 'tx_1' },
        timestamp: 1000,
        attempts: 0
      });

      await IndexedDBAdapter.put(IDB_CONFIG.stores.OUTBOX, {
        id: 'op_2',
        userId: 'u1',
        entity: 'transaction',
        action: 'delete',
        payload: { id: 'tx_1' },
        timestamp: 1050,
        attempts: 0
      });

      expect(await OutboxService.getPendingCount()).toBe(2);

      const drainResult = await OutboxService.flush();
      expect(drainResult).toBe(true);
      expect(processed).toEqual(['op_1', 'op_2']);

      const remaining = await OutboxService.getPending();
      expect(remaining.length).toBe(0);
    });

    it('halts draining and preserves causal FIFO order when an operation fails', async () => {
      const processed: string[] = [];

      OutboxService.setExecutor(async (op: OutboxOperation) => {
        processed.push(op.id);
        if (op.id === 'op_fail') {
          throw new Error('Network timeout: 504 Gateway Timeout');
        }
        return true;
      });

      await IndexedDBAdapter.put(IDB_CONFIG.stores.OUTBOX, {
        id: 'op_fail',
        userId: 'u1',
        entity: 'transaction',
        action: 'create',
        payload: { id: 'tx_failed' },
        timestamp: 1000,
        attempts: 0
      });

      await IndexedDBAdapter.put(IDB_CONFIG.stores.OUTBOX, {
        id: 'op_after',
        userId: 'u1',
        entity: 'transaction',
        action: 'update',
        payload: { id: 'tx_failed', amount: 999 },
        timestamp: 2000,
        attempts: 0
      });

      const drainResult = await OutboxService.flush();
      expect(drainResult).toBe(false);

      // Only the first operation was attempted; the second was blocked to preserve causal order
      expect(processed).toEqual(['op_fail']);

      const pending = await OutboxService.getPending();
      expect(pending.length).toBe(2);
      expect(pending[0].id).toBe('op_fail');
      expect(pending[0].attempts).toBe(1);
      expect(pending[0].lastError).toContain('Network timeout');
      expect(pending[1].id).toBe('op_after');
      expect(pending[1].attempts).toBe(0);
    });

    it('handles executor returning false gracefully', async () => {
      OutboxService.setExecutor(async () => false);

      await IndexedDBAdapter.put(IDB_CONFIG.stores.OUTBOX, {
        id: 'op_rejected',
        userId: 'u1',
        entity: 'budget',
        action: 'update',
        payload: { id: 'b_1' },
        timestamp: 1000,
        attempts: 0
      });

      const drainResult = await OutboxService.flush();
      expect(drainResult).toBe(false);

      const pending = await OutboxService.getPending();
      expect(pending.length).toBe(1);
      expect(pending[0].attempts).toBe(1);
      expect(pending[0].lastError).toBe('Operación rechazada por el servidor');
    });

    it('aborts flush immediately when navigator.onLine is explicitly false', async () => {
      const originalOnLine = typeof navigator !== 'undefined' ? navigator.onLine : undefined;
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        configurable: true,
        writable: true
      });

      let called = false;
      OutboxService.setExecutor(async () => {
        called = true;
        return true;
      });

      await IndexedDBAdapter.put(IDB_CONFIG.stores.OUTBOX, {
        id: 'op_offline',
        userId: 'u1',
        entity: 'card',
        action: 'create',
        payload: { id: 'c_1' },
        timestamp: 1000,
        attempts: 0
      });

      const drainResult = await OutboxService.flush();
      expect(drainResult).toBe(false);
      expect(called).toBe(false);

      // Restore navigator
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: originalOnLine },
        configurable: true,
        writable: true
      });
    });

    it('clears all operations when clearPending is invoked', async () => {
      OutboxService.setExecutor(async () => false);

      await OutboxService.enqueue({
        entity: 'goal',
        action: 'create',
        payload: { id: 'g_1', name: 'Auto' },
        userId: 'u1'
      });

      expect(await OutboxService.getPendingCount()).toBeGreaterThan(0);
      await OutboxService.clearPending();
      expect(await OutboxService.getPendingCount()).toBe(0);
    });
  });
});

