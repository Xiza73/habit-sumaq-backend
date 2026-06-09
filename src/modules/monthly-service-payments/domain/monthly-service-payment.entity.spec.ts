import { buildMonthlyServicePayment } from './__tests__/monthly-service-payment.factory';
import { isValidPeriodFormat } from './monthly-service-payment.entity';

describe('MonthlyServicePayment', () => {
  describe('update', () => {
    it('updates only the provided mutable fields', () => {
      const p = buildMonthlyServicePayment({ amount: 50, description: 'old' });
      p.update({ amount: 75 });

      expect(p.amount).toBe(75);
      expect(p.description).toBe('old');
    });

    it('rounds amount to 2 decimal places (kills float drift)', () => {
      const p = buildMonthlyServicePayment({ amount: 50 });
      p.update({ amount: 12.345 });
      expect(p.amount).toBe(12.35);
    });

    it('accepts explicit null to clear description', () => {
      const p = buildMonthlyServicePayment({ description: 'set' });
      p.update({ description: null });
      expect(p.description).toBeNull();
    });

    it('bumps updatedAt on every update', () => {
      const original = new Date('2026-01-01T00:00:00.000Z');
      const p = buildMonthlyServicePayment({ updatedAt: original });
      p.update({ amount: 1 });
      expect(p.updatedAt.getTime()).toBeGreaterThan(original.getTime());
    });

    it('updates date field when provided', () => {
      const p = buildMonthlyServicePayment();
      const newDate = new Date('2026-07-01T00:00:00.000Z');
      p.update({ date: newDate });
      expect(p.date).toBe(newDate);
    });
  });

  describe('isDeleted', () => {
    it('returns true when deletedAt is set', () => {
      expect(buildMonthlyServicePayment({ deletedAt: new Date() }).isDeleted()).toBe(true);
    });

    it('returns false when deletedAt is null', () => {
      expect(buildMonthlyServicePayment({ deletedAt: null }).isDeleted()).toBe(false);
    });
  });
});

describe('isValidPeriodFormat', () => {
  it.each([
    ['2026-01', true],
    ['2026-12', true],
    ['2000-06', true],
    ['9999-09', true],
  ])('accepts well-formed YYYY-MM: %s', (input, expected) => {
    expect(isValidPeriodFormat(input)).toBe(expected);
  });

  it.each([
    ['2026-00', false],
    ['2026-13', false],
    ['2026-1', false],
    ['26-06', false],
    ['2026/06', false],
    ['2026-06-15', false],
    ['', false],
    ['abc', false],
    ['2026-6', false],
  ])('rejects malformed input: %s', (input, expected) => {
    expect(isValidPeriodFormat(input)).toBe(expected);
  });
});
