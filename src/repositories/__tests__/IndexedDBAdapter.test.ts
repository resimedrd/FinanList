import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDBAdapter, IDB_CONFIG } from '../IndexedDBAdapter';
import { KEYS } from '../LocalRepository';
import { Transaction, PaymentCard, Budget } from '../../models/types';

// Mock localStorage in Node.js test environment
const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = String(v); },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  key: (i: number) => Object.keys(mockStorage)[i] || null,
  get length() { return Object.keys(mockStorage).length; }
};

describe('IndexedDBAdapter & Storage Migration', () => {
  beforeEach(async () => {
    localStorage.clear();
    // Clear stores before each test
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.TRANSACTIONS);
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.CARDS);
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.BUDGETS);
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.GOALS);
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.DEBTS);
    await IndexedDBAdapter.deleteKeyVal('profile');
    await IndexedDBAdapter.deleteKeyVal('migrated_from_localstorage_at');
  });

  describe('CRUD operations', () => {
    it('stores and retrieves items with setAll and getAll', async () => {
      const mockCards: PaymentCard[] = [
        {
          id: 'card_1',
          name: 'Tarjeta Principal',
          bank: 'Banco Popular',
          type: 'debit',
          currency: 'RD$',
          color: '#059669',
          currentBalance: 25000,
          isActive: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 'card_2',
          name: 'Tarjeta de Crédito',
          bank: 'BHD',
          type: 'credit',
          currency: 'RD$',
          color: '#4f46e5',
          creditLimit: 50000,
          balanceUsed: 12000,
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ];

      await IndexedDBAdapter.setAll(IDB_CONFIG.stores.CARDS, mockCards);
      const retrieved = await IndexedDBAdapter.getAll<PaymentCard>(IDB_CONFIG.stores.CARDS);

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].name).toBe('Tarjeta Principal');
      expect(retrieved[1].creditLimit).toBe(50000);
    });

    it('inserts and updates item with put', async () => {
      const tx: Transaction = {
        id: 'tx_test_1',
        amount: 1500,
        type: 'expense',
        categoryId: 'cat_food',
        paymentMethod: 'card',
        account: 'BHD Débito',
        color: '#ff4d4d',
        icon: 'Utensils',
        date: '2026-10-05',
        time: '14:30',
        notes: 'Almuerzo'
      };

      await IndexedDBAdapter.put(IDB_CONFIG.stores.TRANSACTIONS, tx);
      let txs = await IndexedDBAdapter.getAll<Transaction>(IDB_CONFIG.stores.TRANSACTIONS);
      expect(txs).toHaveLength(1);
      expect(txs[0].amount).toBe(1500);

      // Update same transaction
      const updatedTx: Transaction = { ...tx, amount: 1850, notes: 'Almuerzo familiar' };
      await IndexedDBAdapter.put(IDB_CONFIG.stores.TRANSACTIONS, updatedTx);

      txs = await IndexedDBAdapter.getAll<Transaction>(IDB_CONFIG.stores.TRANSACTIONS);
      expect(txs).toHaveLength(1);
      expect(txs[0].amount).toBe(1850);
      expect(txs[0].notes).toBe('Almuerzo familiar');
    });

    it('deletes an item by id', async () => {
      const b1: Budget = {
        id: 'budget_1',
        name: 'Comida',
        amount: 10000,
        type: 'category',
        categoryId: 'cat_food',
        startDate: '2026-10-01',
        endDate: '2026-10-31'
      };
      const b2: Budget = {
        id: 'budget_2',
        name: 'Transporte',
        amount: 5000,
        type: 'category',
        categoryId: 'cat_trans',
        startDate: '2026-10-01',
        endDate: '2026-10-31'
      };

      await IndexedDBAdapter.setAll(IDB_CONFIG.stores.BUDGETS, [b1, b2]);
      await IndexedDBAdapter.delete(IDB_CONFIG.stores.BUDGETS, 'budget_1');

      const remaining = await IndexedDBAdapter.getAll<Budget>(IDB_CONFIG.stores.BUDGETS);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('budget_2');
    });

    it('clears all items from a store', async () => {
      await IndexedDBAdapter.setAll(IDB_CONFIG.stores.BUDGETS, [
        {
          id: 'b_1',
          name: 'Test',
          amount: 1000,
          type: 'monthly',
          startDate: '2026-10-01',
          endDate: '2026-10-31'
        }
      ]);

      await IndexedDBAdapter.clear(IDB_CONFIG.stores.BUDGETS);
      const items = await IndexedDBAdapter.getAll<Budget>(IDB_CONFIG.stores.BUDGETS);
      expect(items).toHaveLength(0);
    });

    it('handles key-value store for user profile and config', async () => {
      const mockProfile = {
        name: 'Frank',
        currency: 'RD$',
        language: 'es',
        theme: 'dark' as const
      };

      await IndexedDBAdapter.setKeyVal('profile', mockProfile);
      const retrieved = await IndexedDBAdapter.getKeyVal<typeof mockProfile>('profile');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Frank');
      expect(retrieved?.currency).toBe('RD$');

      await IndexedDBAdapter.deleteKeyVal('profile');
      const afterDelete = await IndexedDBAdapter.getKeyVal('profile');
      expect(afterDelete).toBeNull();
    });
  });

  describe('Large receipt photos (Base64 storage resilience)', () => {
    it('stores and retrieves large Base64 photo payloads without quota errors', async () => {
      // Simulate large photo data URI string (~120 KB)
      const largeBase64Receipt = 'data:image/jpeg;base64,' + 'A'.repeat(120000);

      const txWithPhoto: Transaction = {
        id: 'tx_receipt_heavy',
        amount: 3200,
        type: 'expense',
        categoryId: 'cat_super',
        paymentMethod: 'card',
        account: 'Visa Débito',
        color: '#ff4d4d',
        icon: 'ShoppingBag',
        date: '2026-10-05',
        time: '16:00',
        receiptPhoto: largeBase64Receipt
      };

      await IndexedDBAdapter.put(IDB_CONFIG.stores.TRANSACTIONS, txWithPhoto);
      const retrieved = await IndexedDBAdapter.getAll<Transaction>(IDB_CONFIG.stores.TRANSACTIONS);

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].receiptPhoto).toBe(largeBase64Receipt);
      expect(retrieved[0].receiptPhoto?.length).toBeGreaterThan(120000);
    });
  });

  describe('localStorage to IndexedDB Migration', () => {
    it('migrates legacy localStorage data to IndexedDB and frees localStorage quota', async () => {
      // 1. Setup legacy data in localStorage
      const legacyTxs: Transaction[] = [
        {
          id: 'tx_legacy_1',
          amount: 500,
          type: 'expense',
          categoryId: 'cat_food',
          account: 'Efectivo',
          color: '#ff4d4d',
          icon: 'Utensils',
          date: '2026-09-01',
          time: '12:00'
        }
      ];
      const legacyCards: PaymentCard[] = [
        {
          id: 'card_legacy_1',
          name: 'Nómina',
          bank: 'Popular',
          type: 'debit',
          currency: 'RD$',
          color: '#059669',
          isActive: true,
          currentBalance: 10000,
          createdAt: '2026-09-01'
        }
      ];

      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(legacyTxs));
      localStorage.setItem(KEYS.CARDS, JSON.stringify(legacyCards));
      localStorage.setItem(KEYS.PROFILE, JSON.stringify({ name: 'Frank Legacy' }));

      // 2. Execute migration
      const migrated = await IndexedDBAdapter.migrateFromLocalStorage(KEYS);
      expect(migrated).toBe(true);

      // 3. Verify data exists in IndexedDB
      const migratedTxs = await IndexedDBAdapter.getAll<Transaction>(IDB_CONFIG.stores.TRANSACTIONS);
      expect(migratedTxs).toHaveLength(1);
      expect(migratedTxs[0].id).toBe('tx_legacy_1');

      const migratedCards = await IndexedDBAdapter.getAll<PaymentCard>(IDB_CONFIG.stores.CARDS);
      expect(migratedCards).toHaveLength(1);
      expect(migratedCards[0].name).toBe('Nómina');

      const migratedProfile = await IndexedDBAdapter.getKeyVal<{ name: string }>('profile');
      expect(migratedProfile?.name).toBe('Frank Legacy');

      // 4. Verify heavy keys were removed from localStorage to free 5MB quota
      expect(localStorage.getItem(KEYS.TRANSACTIONS)).toBeNull();
      expect(localStorage.getItem(KEYS.CARDS)).toBeNull();

      // 5. Running migration again when no localStorage keys exist returns false
      const reMigration = await IndexedDBAdapter.migrateFromLocalStorage(KEYS);
      expect(reMigration).toBe(false);
    });
  });
});
