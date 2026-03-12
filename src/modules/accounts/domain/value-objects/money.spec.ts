import { DomainException } from '@common/exceptions/domain.exception';

import { Currency } from '../enums/currency.enum';

import { Money } from './money';

describe('Money', () => {
  describe('constructor', () => {
    it('should create a Money instance with valid amount and currency', () => {
      const money = new Money(100, Currency.PEN);
      expect(money.amount).toBe(100);
      expect(money.currency).toBe(Currency.PEN);
    });

    it('should throw INVALID_MONEY_AMOUNT when amount is negative', () => {
      expect(() => new Money(-1, Currency.PEN)).toThrow(DomainException);
    });

    it('should allow amount of zero', () => {
      expect(() => new Money(0, Currency.PEN)).not.toThrow();
    });
  });

  describe('add()', () => {
    it('should return a new Money with the sum of both amounts', () => {
      const a = new Money(100, Currency.PEN);
      const b = new Money(50, Currency.PEN);
      const result = a.add(b);
      expect(result.amount).toBe(150);
      expect(result.currency).toBe(Currency.PEN);
    });

    it('should throw CURRENCY_MISMATCH when currencies differ', () => {
      const pen = new Money(100, Currency.PEN);
      const usd = new Money(50, Currency.USD);
      expect(() => pen.add(usd)).toThrow(DomainException);
    });
  });

  describe('equals()', () => {
    it('should return true when amount and currency match', () => {
      const a = new Money(100, Currency.PEN);
      const b = new Money(100, Currency.PEN);
      expect(a.equals(b)).toBe(true);
    });

    it('should return false when amounts differ', () => {
      const a = new Money(100, Currency.PEN);
      const b = new Money(200, Currency.PEN);
      expect(a.equals(b)).toBe(false);
    });

    it('should return false when currencies differ', () => {
      const a = new Money(100, Currency.PEN);
      const b = new Money(100, Currency.USD);
      expect(a.equals(b)).toBe(false);
    });
  });
});
