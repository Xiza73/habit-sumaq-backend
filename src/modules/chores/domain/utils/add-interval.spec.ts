import { IntervalUnit } from '../enums/interval-unit.enum';

import { addInterval } from './add-interval';

describe('addInterval', () => {
  describe('days', () => {
    it('adds N days to a date', () => {
      expect(addInterval('2026-04-01', 5, IntervalUnit.DAYS)).toBe('2026-04-06');
    });

    it('crosses a month boundary cleanly', () => {
      expect(addInterval('2026-04-30', 2, IntervalUnit.DAYS)).toBe('2026-05-02');
    });

    it('crosses a year boundary cleanly', () => {
      expect(addInterval('2026-12-30', 5, IntervalUnit.DAYS)).toBe('2027-01-04');
    });

    it('leap year: Feb 28 + 1 day = Feb 29 in 2024', () => {
      expect(addInterval('2024-02-28', 1, IntervalUnit.DAYS)).toBe('2024-02-29');
    });
  });

  describe('weeks', () => {
    it('adds N * 7 days', () => {
      expect(addInterval('2026-04-01', 2, IntervalUnit.WEEKS)).toBe('2026-04-15');
    });

    it('crosses month boundaries via weekly math', () => {
      expect(addInterval('2026-04-25', 2, IntervalUnit.WEEKS)).toBe('2026-05-09');
    });
  });

  describe('months', () => {
    it('adds N months keeping the day when valid', () => {
      expect(addInterval('2026-04-15', 3, IntervalUnit.MONTHS)).toBe('2026-07-15');
    });

    it('clamps Jan 31 + 1 month to Feb 28 in non-leap years', () => {
      // Critical case: JS Date(2026, 0, 31) + 1 month must NOT be Mar 3.
      expect(addInterval('2026-01-31', 1, IntervalUnit.MONTHS)).toBe('2026-02-28');
    });

    it('clamps Jan 31 + 1 month to Feb 29 in leap years (2024)', () => {
      expect(addInterval('2024-01-31', 1, IntervalUnit.MONTHS)).toBe('2024-02-29');
    });

    it('crosses a year boundary', () => {
      expect(addInterval('2026-11-15', 3, IntervalUnit.MONTHS)).toBe('2027-02-15');
    });

    it('clamps Mar 31 + 1 month to Apr 30 (Apr only has 30 days)', () => {
      expect(addInterval('2026-03-31', 1, IntervalUnit.MONTHS)).toBe('2026-04-30');
    });
  });

  describe('years', () => {
    it('adds N years keeping the day-of-month', () => {
      expect(addInterval('2026-04-15', 2, IntervalUnit.YEARS)).toBe('2028-04-15');
    });

    it('clamps Feb 29 + 1 year to Feb 28 in non-leap years', () => {
      // 2024 is leap, 2025 is not — Feb 29 must clamp to Feb 28.
      expect(addInterval('2024-02-29', 1, IntervalUnit.YEARS)).toBe('2025-02-28');
    });

    it('keeps Feb 29 when target year is also leap (2024 -> 2028)', () => {
      expect(addInterval('2024-02-29', 4, IntervalUnit.YEARS)).toBe('2028-02-29');
    });
  });

  describe('input validation', () => {
    it('throws on non-positive value', () => {
      expect(() => addInterval('2026-04-15', 0, IntervalUnit.DAYS)).toThrow(/positive integer/);
      expect(() => addInterval('2026-04-15', -1, IntervalUnit.DAYS)).toThrow(/positive integer/);
    });

    it('throws on non-integer value', () => {
      expect(() => addInterval('2026-04-15', 1.5, IntervalUnit.DAYS)).toThrow(/positive integer/);
    });

    it('throws on malformed date', () => {
      expect(() => addInterval('2026/04/15', 1, IntervalUnit.DAYS)).toThrow(/YYYY-MM-DD/);
      expect(() => addInterval('not-a-date', 1, IntervalUnit.DAYS)).toThrow(/YYYY-MM-DD/);
    });
  });
});
