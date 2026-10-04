import { describe, it, expect } from 'vitest';
import {
  parseLocalDate,
  createLocalDate,
  formatLocalDateISO,
  getTodayDateString,
  getDaysInMonth,
  getMonthName
} from '../dateUtils';

describe('dateUtils', () => {
  it('correctly parses ISO date string into numeric parts without UTC shift', () => {
    const parts = parseLocalDate('2026-09-20');
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(9);
    expect(parts.day).toBe(20);
  });

  it('handles invalid or empty date strings by falling back to current date', () => {
    const parts = parseLocalDate('');
    const now = new Date();
    expect(parts.year).toBe(now.getFullYear());
    expect(parts.month).toBe(now.getMonth() + 1);
  });

  it('creates local Date object anchored at 12:00:00 local time', () => {
    const date = createLocalDate('2026-01-15');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0); // 0-indexed in JS Date
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(12);
  });

  it('formats Date instance to YYYY-MM-DD exactly', () => {
    const date = new Date(2026, 4, 3, 10, 0, 0); // May 3, 2026
    expect(formatLocalDateISO(date)).toBe('2026-05-03');
  });

  it('getTodayDateString returns a valid 10-char YYYY-MM-DD string', () => {
    const today = getTodayDateString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns exact days in month for regular and leap years', () => {
    // February in non-leap year (2025)
    expect(getDaysInMonth(2025, 2)).toBe(28);
    // February in leap year (2024)
    expect(getDaysInMonth(2024, 2)).toBe(29);
    // 31-day months
    expect(getDaysInMonth(2026, 1)).toBe(31); // January
    expect(getDaysInMonth(2026, 3)).toBe(31); // March
    expect(getDaysInMonth(2026, 7)).toBe(31); // July
    expect(getDaysInMonth(2026, 8)).toBe(31); // August
    expect(getDaysInMonth(2026, 12)).toBe(31); // December
    // 30-day months
    expect(getDaysInMonth(2026, 4)).toBe(30); // April
    expect(getDaysInMonth(2026, 6)).toBe(30); // June
    expect(getDaysInMonth(2026, 9)).toBe(30); // September
    expect(getDaysInMonth(2026, 11)).toBe(30); // November
  });

  it('returns capitalized Spanish month names', () => {
    expect(getMonthName(1)).toBe('Enero');
    expect(getMonthName(9)).toBe('Septiembre');
    expect(getMonthName(12)).toBe('Diciembre');
  });
});
