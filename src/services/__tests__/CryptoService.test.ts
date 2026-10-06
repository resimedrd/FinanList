import { describe, it, expect } from 'vitest';
import { CryptoService } from '../CryptoService';

describe('CryptoService', () => {
  describe('generateSalt', () => {
    it('generates a 32-character hexadecimal salt (16 bytes)', () => {
      const salt = CryptoService.generateSalt();
      expect(salt).toHaveLength(32);
      expect(salt).toMatch(/^[0-9a-f]{32}$/);
    });

    it('generates unique salts on consecutive calls', () => {
      const salt1 = CryptoService.generateSalt();
      const salt2 = CryptoService.generateSalt();
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('bytesToHex & hexToBytes', () => {
    it('converts Uint8Array to hex and back accurately', () => {
      const bytes = new Uint8Array([0, 15, 255, 128, 42]);
      const hex = CryptoService.bytesToHex(bytes);
      expect(hex).toBe('000fff802a');

      const recoveredBytes = CryptoService.hexToBytes(hex);
      expect(Array.from(recoveredBytes)).toEqual(Array.from(bytes));
    });
  });

  describe('constantTimeEquals', () => {
    it('returns true for matching strings', () => {
      expect(CryptoService.constantTimeEquals('secret123', 'secret123')).toBe(true);
      expect(CryptoService.constantTimeEquals('', '')).toBe(true);
    });

    it('returns false for mismatched strings of same length', () => {
      expect(CryptoService.constantTimeEquals('secret123', 'secret124')).toBe(false);
    });

    it('returns false for mismatched strings of different lengths', () => {
      expect(CryptoService.constantTimeEquals('secret', 'secret123')).toBe(false);
    });
  });

  describe('isLegacyPlaintext', () => {
    it('identifies 4 to 6 digit plain text PINs', () => {
      expect(CryptoService.isLegacyPlaintext('1234')).toBe(true);
      expect(CryptoService.isLegacyPlaintext('0000')).toBe(true);
      expect(CryptoService.isLegacyPlaintext('123456')).toBe(true);
    });

    it('returns false for undefined, null, or empty', () => {
      expect(CryptoService.isLegacyPlaintext(undefined)).toBe(false);
      expect(CryptoService.isLegacyPlaintext('')).toBe(false);
    });

    it('returns false for modern hashed formats', () => {
      expect(CryptoService.isLegacyPlaintext('sha256$abc$1234567890abcdef')).toBe(false);
      expect(CryptoService.isLegacyPlaintext('pbkdf2$abc$1234567890abcdef')).toBe(false);
    });

    it('returns false for strings with non-digit characters or irregular length', () => {
      expect(CryptoService.isLegacyPlaintext('12a4')).toBe(false);
      expect(CryptoService.isLegacyPlaintext('12')).toBe(false);
      expect(CryptoService.isLegacyPlaintext('1234567890')).toBe(false);
    });
  });

  describe('hashPin & verifyPin', () => {
    it('produces deterministic hash when salt is provided', async () => {
      const salt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const hash1 = await CryptoService.hashPin('1234', salt);
      const hash2 = await CryptoService.hashPin('1234', salt);

      expect(hash1).toBe(hash2);
      expect(hash1.startsWith('sha256$' + salt + '$')).toBe(true);
    });

    it('produces unique hashes when no salt is provided (random salt)', async () => {
      const hash1 = await CryptoService.hashPin('1234');
      const hash2 = await CryptoService.hashPin('1234');

      expect(hash1).not.toBe(hash2);
      expect(hash1.startsWith('sha256$')).toBe(true);
      expect(hash2.startsWith('sha256$')).toBe(true);
    });

    it('verifies a valid SHA-256 hashed PIN', async () => {
      const hashed = await CryptoService.hashPin('5678');
      const isValid = await CryptoService.verifyPin('5678', hashed);
      expect(isValid).toBe(true);
    });

    it('rejects an incorrect PIN against SHA-256 hash', async () => {
      const hashed = await CryptoService.hashPin('5678');
      const isValid = await CryptoService.verifyPin('9999', hashed);
      expect(isValid).toBe(false);
    });

    it('verifies transparently against legacy plaintext PINs', async () => {
      const legacyStored = '1234';
      expect(await CryptoService.verifyPin('1234', legacyStored)).toBe(true);
      expect(await CryptoService.verifyPin('4321', legacyStored)).toBe(false);
    });

    it('handles direct salt parameter verification', async () => {
      const salt = '00112233445566778899aabbccddeeff';
      const hashed = await CryptoService.hashPin('4321', salt);
      const rawHex = hashed.split('$')[2];

      // Verifying with 64-char raw hash and salt
      const isValid = await CryptoService.verifyPin('4321', rawHex, salt);
      expect(isValid).toBe(true);

      const isInvalid = await CryptoService.verifyPin('0000', rawHex, salt);
      expect(isInvalid).toBe(false);
    });
  });
});
