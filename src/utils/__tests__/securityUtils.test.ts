import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSalt,
  hashPin,
  verifyPin,
  isLegacyPlaintextPin,
  constantTimeEquals,
  checkPinLockout,
  recordFailedPinAttempt,
  resetPinLockout
} from '../securityUtils';

describe('securityUtils', () => {
  beforeEach(() => {
    resetPinLockout();
  });

  describe('Salting & PBKDF2 Hashing', () => {
    it('generates a 32-character hexadecimal salt (16 bytes)', () => {
      const salt = generateSalt();
      expect(salt).toHaveLength(32);
      expect(salt).toMatch(/^[0-9a-f]{32}$/);
    });

    it('hashes PIN with PBKDF2 producing standardized prefix and hex hash', async () => {
      const hashed = await hashPin('1234');
      expect(hashed.startsWith('pbkdf2$')).toBe(true);
      const parts = hashed.split('$');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('pbkdf2');
      expect(parts[1]).toHaveLength(32); // salt hex
      expect(parts[2]).toHaveLength(64); // 32 bytes SHA-256 in hex
    });

    it('produces identical hash for the same PIN and salt', async () => {
      const salt = generateSalt();
      const hash1 = await hashPin('4321', salt);
      const hash2 = await hashPin('4321', salt);
      expect(hash1).toBe(hash2);
    });
  });

  describe('PIN Verification & Backward Compatibility', () => {
    it('correctly verifies a modern PBKDF2 hashed PIN', async () => {
      const stored = await hashPin('7890');
      const isValid = await verifyPin('7890', stored);
      expect(isValid).toBe(true);
    });

    it('rejects an incorrect PIN against a PBKDF2 hash', async () => {
      const stored = await hashPin('7890');
      const isValid = await verifyPin('0000', stored);
      expect(isValid).toBe(false);
    });

    it('transparently verifies legacy plaintext PIN (e.g., "1234")', async () => {
      expect(isLegacyPlaintextPin('1234')).toBe(true);
      const isValid = await verifyPin('1234', '1234');
      expect(isValid).toBe(true);

      const isInvalid = await verifyPin('9999', '1234');
      expect(isInvalid).toBe(false);
    });

    it('constantTimeEquals detects equality and mismatches', () => {
      expect(constantTimeEquals('secret', 'secret')).toBe(true);
      expect(constantTimeEquals('secret', 'attack')).toBe(false);
      expect(constantTimeEquals('short', 'longer_string')).toBe(false);
    });
  });

  describe('Progressive Lockout Mechanism', () => {
    it('initial state is unlocked with 0 failed attempts', () => {
      const state = checkPinLockout();
      expect(state.isLocked).toBe(false);
      expect(state.failedAttempts).toBe(0);
    });

    it('locks out for 30s after 3 failed attempts', () => {
      recordFailedPinAttempt(); // 1
      recordFailedPinAttempt(); // 2
      const third = recordFailedPinAttempt(); // 3

      expect(third.isLocked).toBe(true);
      expect(third.remainingSeconds).toBeGreaterThan(0);
      expect(third.remainingSeconds).toBeLessThanOrEqual(30);

      const current = checkPinLockout();
      expect(current.isLocked).toBe(true);
    });

    it('locks out for 5 minutes (300s) after 5 failed attempts', () => {
      for (let i = 0; i < 5; i++) {
        recordFailedPinAttempt();
      }

      const state = checkPinLockout();
      expect(state.isLocked).toBe(true);
      expect(state.remainingSeconds).toBeGreaterThan(30);
      expect(state.remainingSeconds).toBeLessThanOrEqual(300);
    });

    it('resets lockout on resetPinLockout()', () => {
      for (let i = 0; i < 4; i++) {
        recordFailedPinAttempt();
      }
      expect(checkPinLockout().isLocked).toBe(true);

      resetPinLockout();
      const state = checkPinLockout();
      expect(state.isLocked).toBe(false);
      expect(state.failedAttempts).toBe(0);
    });
  });
});
