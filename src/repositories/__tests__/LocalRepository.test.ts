import { describe, it, expect, beforeEach } from 'vitest';
import { LocalRepository, KEYS } from '../LocalRepository';
import { IndexedDBAdapter, IDB_CONFIG } from '../IndexedDBAdapter';
import { PaymentCard, Transaction } from '../../models/types';

// Mock localStorage in Node environment
const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = String(v); },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  key: (i: number) => Object.keys(mockStorage)[i] || null,
  get length() { return Object.keys(mockStorage).length; }
};

describe('LocalRepository - Reset & Ghost Data Prevention', () => {
  beforeEach(async () => {
    localStorage.clear();
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.TRANSACTIONS);
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.CARDS);
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.OUTBOX);
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.BUDGETS);
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.GOALS);
    await IndexedDBAdapter.clear(IDB_CONFIG.stores.DEBTS);
    await IndexedDBAdapter.deleteKeyVal('last_reset_at');
    await IndexedDBAdapter.deleteKeyVal('is_reset');
  });

  it('never re-injects DEFAULT_CARDS when cards are empty', () => {
    // Simulate user with 0 cards
    localStorage.setItem(KEYS.CARDS, '[]');
    (LocalRepository as any).cache.cards = [];

    const cards = LocalRepository.getCards();
    expect(cards).toEqual([]);
    expect(cards.length).toBe(0);
  });

  it('resetFinancialData clears cache, localStorage and IndexedDB completely', async () => {
    // 1. Setup pre-existing data
    const testCard: PaymentCard = {
      id: 'card_user_real',
      name: 'Mi Tarjeta Real',
      bank: 'Banco BHD',
      type: 'debit',
      currency: 'RD$',
      color: '#059669',
      currentBalance: 50000,
      isActive: true,
      createdAt: '2026-10-01'
    };
    const testTx: Transaction = {
      id: 'tx_user_real',
      amount: 1200,
      type: 'expense',
      categoryId: 'cat_food_super',
      account: 'Mi Tarjeta Real',
      date: '2026-10-02',
      time: '12:00',
      color: '#ff4d4d',
      icon: 'ShoppingBasket'
    };

    LocalRepository.saveCards([testCard]);
    LocalRepository.saveTransactions([testTx]);

    expect(LocalRepository.getCards()).toHaveLength(1);
    expect(LocalRepository.getTransactions()).toHaveLength(1);

    // 2. Execute resetFinancialData
    await LocalRepository.resetFinancialData();

    // 3. Verify in-memory cache is empty
    expect(LocalRepository.getCards()).toEqual([]);
    expect(LocalRepository.getTransactions()).toEqual([]);
    expect(LocalRepository.getBudgets()).toEqual([]);
    expect(LocalRepository.getGoals()).toEqual([]);
    expect(LocalRepository.getDebts()).toEqual([]);

    // 4. Verify localStorage has explicit empty JSON arrays, not null
    expect(localStorage.getItem(KEYS.CARDS)).toBe('[]');
    expect(localStorage.getItem(KEYS.TRANSACTIONS)).toBe('[]');
    expect(localStorage.getItem(KEYS.IS_RESET)).toBe('true');
    expect(localStorage.getItem(KEYS.LAST_RESET)).toBeDefined();

    // 5. Verify isReset() reports true
    expect(LocalRepository.isReset()).toBe(true);

    // 6. Verify IndexedDB stores were purged
    const idbCards = await IndexedDBAdapter.getAll<PaymentCard>(IDB_CONFIG.stores.CARDS);
    expect(idbCards).toHaveLength(0);

    const idbTxs = await IndexedDBAdapter.getAll<Transaction>(IDB_CONFIG.stores.TRANSACTIONS);
    expect(idbTxs).toHaveLength(0);

    const idbOutbox = await IndexedDBAdapter.getAll(IDB_CONFIG.stores.OUTBOX);
    expect(idbOutbox).toHaveLength(0);
  });

  it('re-running init() after reset preserves empty cards and does NOT resurrect demo cards', async () => {
    await LocalRepository.resetFinancialData();

    // Reset internal initialized flag to simulate full app reload
    (LocalRepository as any).isInitialized = false;
    (LocalRepository as any).cache = {};

    LocalRepository.init();

    const cardsAfterReload = LocalRepository.getCards();
    expect(cardsAfterReload).toEqual([]);
    expect(cardsAfterReload.length).toBe(0);

    // Ensure no 15,000 balance demo card was created
    expect(cardsAfterReload.some(c => c.name.includes('BHD Débito Nómina'))).toBe(false);
  });
});
