/**
 * OutboxService.ts
 * Implementación del patrón Transaccional Outbox para sincronización resiliente offline-first.
 * Garantiza que ninguna mutación se pierda cuando el usuario opera sin conexión,
 * preservando el orden causal de las operaciones (FIFO) y reintentando automáticamente al reconectar.
 */

import { IndexedDBAdapter, IDB_CONFIG } from '../repositories/IndexedDBAdapter';

export type OutboxEntity =
  | 'transaction'
  | 'card'
  | 'goal'
  | 'debt'
  | 'category'
  | 'budget'
  | 'profile'
  | 'recurring';

export type OutboxAction = 'create' | 'update' | 'delete';

export interface OutboxOperation {
  id: string;
  userId: string;
  entity: OutboxEntity;
  action: OutboxAction;
  payload: any;
  timestamp: number;
  attempts: number;
  lastError?: string;
}

export type OutboxExecutor = (op: OutboxOperation) => Promise<boolean>;

export class OutboxService {
  private static isFlushing = false;
  private static customExecutor: OutboxExecutor | null = null;
  private static onlineListenerAttached = false;

  /**
   * Configura un ejecutor personalizado (usado por AppwriteService o en tests).
   */
  static setExecutor(executor: OutboxExecutor | null): void {
    this.customExecutor = executor;
  }

  /**
   * Encola una operación en la cola outbox en IndexedDB y dispara el drenado.
   */
  static async enqueue(opData: {
    entity: OutboxEntity;
    action: OutboxAction;
    payload: any;
    userId: string;
  }): Promise<OutboxOperation> {
    const operation: OutboxOperation = {
      id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: opData.userId,
      entity: opData.entity,
      action: opData.action,
      payload: opData.payload,
      timestamp: Date.now(),
      attempts: 0
    };

    await IndexedDBAdapter.put(IDB_CONFIG.stores.OUTBOX, operation);

    // Intentar drenar inmediatamente de forma asíncrona no bloqueante
    this.flush().catch((err) => {
      console.warn('[OutboxService] Error en auto-flush tras enqueue:', err);
    });

    return operation;
  }

  /**
   * Obtiene todas las operaciones pendientes en orden FIFO (más antiguas primero).
   */
  static async getPending(): Promise<OutboxOperation[]> {
    const ops = await IndexedDBAdapter.getAll<OutboxOperation>(IDB_CONFIG.stores.OUTBOX);
    return ops.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Cantidad de operaciones pendientes encoladas.
   */
  static async getPendingCount(): Promise<number> {
    const list = await this.getPending();
    return list.length;
  }

  /**
   * Limpia todas las operaciones de la cola outbox (usado en tests y reseteo).
   */
  static async clearPending(): Promise<void> {
    this.isFlushing = false;
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.OUTBOX);
  }

  /**
   * Drena secuencialmente las operaciones de la cola outbox en orden FIFO.
   * Si una operación falla por error de red o falta de conexión:
   * 1. Incrementa attempts.
   * 2. Detiene el procesamiento para no desordenar la causalidad.
   * 3. Registra el evento online para reintentar cuando regrese la red.
   */
  static async flush(): Promise<boolean> {
    if (this.isFlushing) {
      return false;
    }

    // Verificar si estamos explícitamente offline
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.attachOnlineListener();
      return false;
    }

    this.isFlushing = true;

    try {
      const pending = await this.getPending();
      if (pending.length === 0) {
        return true;
      }

      for (const op of pending) {
        try {
          let success = false;

          if (this.customExecutor) {
            success = await this.customExecutor(op);
          } else {
            // Importación dinámica diferida de AppwriteService para evitar dependencia circular
            const { AppwriteService } = await import('./AppwriteService');
            success = await AppwriteService.executeOutboxOperation(op);
          }

          if (success) {
            // Operación persistida exitosamente en la nube -> eliminar de la cola
            await IndexedDBAdapter.delete(IDB_CONFIG.stores.OUTBOX, op.id);
          } else {
            // Falla no crítica o temporal: registrar intento y frenar drenado
            op.attempts += 1;
            op.lastError = 'Operación rechazada por el servidor';
            await IndexedDBAdapter.put(IDB_CONFIG.stores.OUTBOX, op);
            this.attachOnlineListener();
            return false;
          }
        } catch (err: any) {
          // Error de red / offline / timeout
          op.attempts += 1;
          op.lastError = err?.message || String(err);
          await IndexedDBAdapter.put(IDB_CONFIG.stores.OUTBOX, op);

          console.warn(`[OutboxService] Fallo de red en operación ${op.id} (${op.entity}:${op.action}). Mutación retenida en cola.`);
          this.attachOnlineListener();
          return false;
        }
      }

      return true;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Registra el listener 'online' del navegador para reanudar el drenado.
   */
  private static attachOnlineListener(): void {
    if (typeof window === 'undefined' || this.onlineListenerAttached) return;

    this.onlineListenerAttached = true;
    const onOnline = () => {
      this.onlineListenerAttached = false;
      window.removeEventListener('online', onOnline);
      console.log('[OutboxService] Conexión restablecida. Drenando cola outbox...');
      this.flush().catch(console.warn);
    };

    window.addEventListener('online', onOnline);
  }
}
