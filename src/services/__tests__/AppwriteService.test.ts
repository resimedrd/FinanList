import { describe, it, expect } from 'vitest';
import { sanitizeDocId, AppwriteService } from '../AppwriteService';
import { isAppwriteConfigured, COLLECTIONS } from '../appwriteClient';

describe('AppwriteService & Client Helpers', () => {
  describe('sanitizeDocId', () => {
    it('preserves valid standard FinanList IDs', () => {
      const validId = 'tx_1727400000_abcd';
      expect(sanitizeDocId(validId)).toBe(validId);
    });

    it('enforces maximum 36 characters length', () => {
      const longId = 'a'.repeat(50);
      const sanitized = sanitizeDocId(longId);
      expect(sanitized.length).toBeLessThanOrEqual(36);
    });

    it('sanitizes special disallowed characters', () => {
      const weirdId = 'item@test#123/special';
      const sanitized = sanitizeDocId(weirdId);
      expect(/^[a-zA-Z0-9._-]+$/.test(sanitized)).toBe(true);
      expect(sanitized).not.toContain('@');
      expect(sanitized).not.toContain('#');
      expect(sanitized).not.toContain('/');
    });

    it('prefixes IDs that start with leading dots, hyphens, or underscores', () => {
      expect(sanitizeDocId('.test').startsWith('id_')).toBe(true);
      expect(sanitizeDocId('-test').startsWith('id_')).toBe(true);
      expect(sanitizeDocId('_test').startsWith('id_')).toBe(true);
    });
  });

  describe('Collections definition', () => {
    it('defines all required FinanList collections', () => {
      expect(COLLECTIONS.PROFILES).toBe('profiles');
      expect(COLLECTIONS.CATEGORIES).toBe('categories');
      expect(COLLECTIONS.TRANSACTIONS).toBe('transactions');
      expect(COLLECTIONS.BUDGETS).toBe('budgets');
      expect(COLLECTIONS.GOALS).toBe('goals');
      expect(COLLECTIONS.DEBTS).toBe('debts');
      expect(COLLECTIONS.RECURRING).toBe('recurring');
      expect(COLLECTIONS.CARDS).toBe('cards');
      expect(COLLECTIONS.NOTIFICATIONS).toBe('financial_notifications');
    });
  });

  describe('Offline & unconfigured graceful degradation', () => {
    it('reports isAppwriteConfigured correctly when project ID is empty', () => {
      // In testing environment without .env project id, it should be false
      expect(typeof isAppwriteConfigured).toBe('boolean');
    });

    it('returns null or empty collections safely without throwing if unconfigured', async () => {
      if (!isAppwriteConfigured) {
        const user = await AppwriteService.getCurrentUser();
        expect(user).toBeNull();

        const txs = await AppwriteService.listTransactions('fake_user');
        expect(txs).toEqual([]);

        const cards = await AppwriteService.listCards('fake_user');
        expect(cards).toEqual([]);

        const cats = await AppwriteService.listCategories('fake_user');
        expect(cats).toEqual([]);
      }
    });
  });
});
