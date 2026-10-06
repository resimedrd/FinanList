/**
 * IndexedDBAdapter.ts
 * Capa de abstracción asíncrona sobre IndexedDB para almacenamiento local de alta capacidad.
 * Elimina las limitaciones de cuota de 5 MB de localStorage y soporta recibos fotográficos en Base64.
 * Incluye fallback seguro en memoria para entornos sin IndexedDB o modo incógnito restringido.
 */

export const IDB_CONFIG = {
  name: 'finanlist_idb',
  version: 2,
  stores: {
    TRANSACTIONS: 'transactions',
    CATEGORIES: 'categories',
    BUDGETS: 'budgets',
    GOALS: 'goals',
    DEBTS: 'debts',
    CARDS: 'cards',
    RECURRING: 'recurring',
    NOTIFICATIONS: 'notifications',
    KEYVAL: 'keyval',
    OUTBOX: 'outbox_operations'
  }
} as const;

export type StoreName = typeof IDB_CONFIG.stores[keyof typeof IDB_CONFIG.stores];

export class IndexedDBAdapter {
  private static dbInstance: IDBDatabase | null = null;
  private static memoryFallback: Map<string, any> = new Map();

  /**
   * Determina si la API nativa de IndexedDB está disponible en el entorno actual.
   */
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  /**
   * Abre o retorna la conexión activa con la base de datos IndexedDB.
   */
  static async openDB(): Promise<IDBDatabase | null> {
    if (!this.isAvailable()) {
      return null;
    }

    if (this.dbInstance) {
      return this.dbInstance;
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(IDB_CONFIG.name, IDB_CONFIG.version);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const stores = IDB_CONFIG.stores;

          // Object stores con keyPath 'id'
          const entityStores = [
            stores.TRANSACTIONS,
            stores.CATEGORIES,
            stores.BUDGETS,
            stores.GOALS,
            stores.DEBTS,
            stores.CARDS,
            stores.RECURRING,
            stores.NOTIFICATIONS,
            stores.OUTBOX
          ];

          for (const s of entityStores) {
            if (!db.objectStoreNames.contains(s)) {
              db.createObjectStore(s, { keyPath: 'id' });
            }
          }

          // Object store clave-valor para perfiles y metadatos
          if (!db.objectStoreNames.contains(stores.KEYVAL)) {
            db.createObjectStore(stores.KEYVAL, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => {
          this.dbInstance = request.result;
          resolve(this.dbInstance);
        };

        request.onerror = (err) => {
          console.warn('[IndexedDBAdapter] Error abriendo IndexedDB, usando fallback:', err);
          resolve(null);
        };
      } catch (err) {
        console.warn('[IndexedDBAdapter] Excepción al inicializar IndexedDB:', err);
        resolve(null);
      }
    });
  }

  /**
   * Obtiene todos los elementos de un store.
   */
  static async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await this.openDB();
    if (!db) {
      return this.memoryFallback.get(storeName) || [];
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();

        req.onsuccess = () => resolve((req.result as T[]) || []);
        req.onerror = () => {
          console.warn(`[IndexedDBAdapter] Error leyendo ${storeName}:`, req.error);
          resolve(this.memoryFallback.get(storeName) || []);
        };
      } catch (err) {
        console.warn(`[IndexedDBAdapter] Excepción en getAll(${storeName}):`, err);
        resolve(this.memoryFallback.get(storeName) || []);
      }
    });
  }

  /**
   * Reemplaza todos los elementos de un store (bulk sync).
   */
  static async setAll<T extends { id: string }>(storeName: StoreName, items: T[]): Promise<void> {
    this.memoryFallback.set(storeName, items);

    const db = await this.openDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        store.clear();
        for (const item of items) {
          store.put(item);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          console.warn(`[IndexedDBAdapter] Error en setAll(${storeName}):`, tx.error);
          resolve();
        };
      } catch (err) {
        console.warn(`[IndexedDBAdapter] Excepción en setAll(${storeName}):`, err);
        resolve();
      }
    });
  }

  /**
   * Inserta o actualiza un documento en un store de entidades.
   */
  static async put<T extends { id: string }>(storeName: StoreName, item: T): Promise<void> {
    const current = this.memoryFallback.get(storeName) || [];
    const idx = current.findIndex((x: any) => x.id === item.id);
    if (idx !== -1) current[idx] = item;
    else current.push(item);
    this.memoryFallback.set(storeName, current);

    const db = await this.openDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Elimina un elemento por ID.
   */
  static async delete(storeName: StoreName, id: string): Promise<void> {
    const current = this.memoryFallback.get(storeName) || [];
    this.memoryFallback.set(storeName, current.filter((x: any) => x.id !== id));

    const db = await this.openDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Limpia completamente un store.
   */
  static async clear(storeName: StoreName): Promise<void> {
    this.memoryFallback.delete(storeName);

    const db = await this.openDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Obtiene un valor de configuración / metadatos del store KEYVAL.
   */
  static async getKeyVal<T>(key: string): Promise<T | null> {
    const mem = this.memoryFallback.get(`kv_${key}`);
    if (mem !== undefined) return mem;

    const db = await this.openDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_CONFIG.stores.KEYVAL, 'readonly');
        const store = tx.objectStore(IDB_CONFIG.stores.KEYVAL);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result && req.result.value !== undefined) {
            resolve(req.result.value as T);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Guarda un valor en el store KEYVAL.
   */
  static async setKeyVal<T>(key: string, value: T): Promise<void> {
    this.memoryFallback.set(`kv_${key}`, value);

    const db = await this.openDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_CONFIG.stores.KEYVAL, 'readwrite');
        const store = tx.objectStore(IDB_CONFIG.stores.KEYVAL);
        store.put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Elimina una clave del store KEYVAL.
   */
  static async deleteKeyVal(key: string): Promise<void> {
    this.memoryFallback.delete(`kv_${key}`);

    const db = await this.openDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_CONFIG.stores.KEYVAL, 'readwrite');
        const store = tx.objectStore(IDB_CONFIG.stores.KEYVAL);
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Migración automática desde localStorage hacia IndexedDB.
   * Si existen datos legados, los traslada a IndexedDB y limpia localStorage para liberar la cuota de 5MB.
   */
  static async migrateFromLocalStorage(keys: Record<string, string>): Promise<boolean> {
    if (typeof localStorage === 'undefined') return false;

    // Si ya se migró previamente, evitar retrabajo
    const alreadyMigrated = await this.getKeyVal<string>('migrated_from_localstorage_at');
    if (alreadyMigrated) return false;

    let hasDataToMigrate = false;
    const migrationPayload: Record<string, any> = {};

    for (const [prop, lsKey] of Object.entries(keys)) {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        hasDataToMigrate = true;
        try {
          migrationPayload[prop] = JSON.parse(raw);
        } catch {
          migrationPayload[prop] = raw;
        }
      }
    }

    if (!hasDataToMigrate) return false;

    // Guardar en IndexedDB
    const stores = IDB_CONFIG.stores;
    if (migrationPayload.TRANSACTIONS && Array.isArray(migrationPayload.TRANSACTIONS)) {
      await this.setAll(stores.TRANSACTIONS, migrationPayload.TRANSACTIONS);
    }
    if (migrationPayload.CATEGORIES && Array.isArray(migrationPayload.CATEGORIES)) {
      await this.setAll(stores.CATEGORIES, migrationPayload.CATEGORIES);
    }
    if (migrationPayload.BUDGETS && Array.isArray(migrationPayload.BUDGETS)) {
      await this.setAll(stores.BUDGETS, migrationPayload.BUDGETS);
    }
    if (migrationPayload.GOALS && Array.isArray(migrationPayload.GOALS)) {
      await this.setAll(stores.GOALS, migrationPayload.GOALS);
    }
    if (migrationPayload.DEBTS && Array.isArray(migrationPayload.DEBTS)) {
      await this.setAll(stores.DEBTS, migrationPayload.DEBTS);
    }
    if (migrationPayload.CARDS && Array.isArray(migrationPayload.CARDS)) {
      await this.setAll(stores.CARDS, migrationPayload.CARDS);
    }
    if (migrationPayload.RECURRING && Array.isArray(migrationPayload.RECURRING)) {
      await this.setAll(stores.RECURRING, migrationPayload.RECURRING);
    }
    if (migrationPayload.NOTIFICATIONS && Array.isArray(migrationPayload.NOTIFICATIONS)) {
      await this.setAll(stores.NOTIFICATIONS, migrationPayload.NOTIFICATIONS);
    }
    if (migrationPayload.PROFILE) {
      await this.setKeyVal('profile', migrationPayload.PROFILE);
    }
    if (migrationPayload.DISTRIBUTION_TARGETS) {
      await this.setKeyVal('distribution_targets', migrationPayload.DISTRIBUTION_TARGETS);
    }
    if (migrationPayload.LAST_RESET) {
      await this.setKeyVal('last_reset_at', migrationPayload.LAST_RESET);
    }

    // Registrar flag de migración completada
    await this.setKeyVal('migrated_from_localstorage_at', new Date().toISOString());

    // Limpieza de claves migradas en localStorage para recuperar cuota
    for (const lsKey of Object.values(keys)) {
      if (lsKey) localStorage.removeItem(lsKey);
    }

    return true;
  }
}
