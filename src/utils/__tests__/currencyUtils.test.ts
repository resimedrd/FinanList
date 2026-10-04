import { describe, it, expect } from 'vitest';
import {
  roundCurrency,
  safeSum,
  safeSubtract,
  safeMultiply,
  formatCurrencyDisplay
} from '../currencyUtils';

describe('currencyUtils', () => {
  it('correctly rounds floating point numbers to 2 decimal places', () => {
    // Classic IEEE 754 precision quirk: 0.1 + 0.2 = 0.30000000000000004
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
    expect(roundCurrency(10.005)).toBe(10.01);
    expect(roundCurrency(19.999)).toBe(20);
    expect(roundCurrency(0)).toBe(0);
  });

  it('safeSum prevents cumulative precision drift', () => {
    const sum = safeSum([0.1, 0.2, 0.3]);
    expect(sum).toBe(0.6);
  });

  it('safeSubtract accurately subtracts monetary values', () => {
    expect(safeSubtract(100.55, 50.25)).toBe(50.3);
    expect(safeSubtract(1.0, 0.9)).toBe(0.1);
  });

  it('safeMultiply handles tax/interest rate calculations accurately', () => {
    // 100 * 0.18 = 18
    expect(safeMultiply(100, 0.18)).toBe(18);
    // 33.33 * 3 = 99.99
    expect(safeMultiply(33.33, 3)).toBe(99.99);
  });

  it('formatCurrencyDisplay formats numbers with symbol and decimals', () => {
    const formatted = formatCurrencyDisplay(1500.5, 'RD$');
    expect(formatted).toContain('RD$');
    expect(formatted).toMatch(/1[.,]500[.,]50/);
  });
});
