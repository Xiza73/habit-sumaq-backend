import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { buildCurrencyPool } from './__tests__/currency-pool.factory';
import { CurrencyPool } from './currency-pool.entity';

describe('CurrencyPool', () => {
  describe('applyDelta', () => {
    it('credits the balance with a positive delta', () => {
      const pool = buildCurrencyPool({ balance: 100 });
      pool.applyDelta(50);
      expect(pool.balance).toBe(150);
    });

    it('debits the balance with a negative delta', () => {
      const pool = buildCurrencyPool({ balance: 100 });
      pool.applyDelta(-30);
      expect(pool.balance).toBe(70);
    });

    it('allows the balance to go negative (e.g. user paid a debt while pool was empty)', () => {
      const pool = buildCurrencyPool({ balance: 10 });
      pool.applyDelta(-25);
      expect(pool.balance).toBe(-15);
    });

    it('rounds to 2 decimal places to keep money math sane across JS floats', () => {
      const pool = buildCurrencyPool({ balance: 0.1 });
      pool.applyDelta(0.2);
      // Naively: 0.1 + 0.2 = 0.30000000000000004 — rounding kills that drift.
      expect(pool.balance).toBe(0.3);
    });

    it('bumps updatedAt on every delta', () => {
      const original = new Date('2026-01-01T00:00:00.000Z');
      const pool = buildCurrencyPool({ updatedAt: original });
      pool.applyDelta(1);
      expect(pool.updatedAt.getTime()).toBeGreaterThan(original.getTime());
    });

    it('does NOT touch createdAt (immutable)', () => {
      const created = new Date('2026-01-01T00:00:00.000Z');
      const pool = buildCurrencyPool({ createdAt: created });
      pool.applyDelta(99);
      expect(pool.createdAt).toEqual(created);
    });
  });

  describe('newWithZeroBalance', () => {
    it('creates a pool with the given userId + currency at balance 0', () => {
      const pool = CurrencyPool.newWithZeroBalance('user-42', Currency.USD);
      expect(pool.userId).toBe('user-42');
      expect(pool.currency).toBe(Currency.USD);
      expect(pool.balance).toBe(0);
      expect(pool.deletedAt).toBeNull();
    });

    it('assigns a unique id each time (two calls produce different ids)', () => {
      const a = CurrencyPool.newWithZeroBalance('user-1', Currency.PEN);
      const b = CurrencyPool.newWithZeroBalance('user-1', Currency.PEN);
      expect(a.id).not.toBe(b.id);
    });

    it('sets createdAt and updatedAt to the same instant on construction', () => {
      const pool = CurrencyPool.newWithZeroBalance('user-1', Currency.EUR);
      expect(pool.createdAt).toEqual(pool.updatedAt);
    });
  });

  describe('isDeleted', () => {
    it('returns false when deletedAt is null', () => {
      const pool = buildCurrencyPool({ deletedAt: null });
      expect(pool.isDeleted()).toBe(false);
    });

    it('returns true when deletedAt is set', () => {
      const pool = buildCurrencyPool({ deletedAt: new Date('2026-05-01T00:00:00.000Z') });
      expect(pool.isDeleted()).toBe(true);
    });
  });
});
