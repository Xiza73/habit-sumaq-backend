import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';

import { buildCurrencyPool } from '../../domain/__tests__/currency-pool.factory';
import { type CurrencyPoolRepository } from '../../domain/currency-pool.repository';
import { CurrencyPoolService } from '../currency-pool.service';

describe('CurrencyPoolService', () => {
  let service: CurrencyPoolService;
  let repo: jest.Mocked<CurrencyPoolRepository>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  const USER_ID = 'user-1';

  beforeEach(() => {
    repo = {
      findByUserIdAndCurrency: jest.fn(),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };

    mockLogger = buildMockPinoLogger();
    service = new CurrencyPoolService(repo, mockLogger as unknown as PinoLogger);
  });

  describe('applyDelta — pool exists', () => {
    it('debits an existing pool (negative delta) and saves it', async () => {
      const existing = buildCurrencyPool({ userId: USER_ID, currency: Currency.PEN, balance: 500 });
      repo.findByUserIdAndCurrency.mockResolvedValue(existing);

      const result = await service.applyDelta(USER_ID, Currency.PEN, -80);

      expect(result.balance).toBe(420);
      expect(repo.save).toHaveBeenCalledWith(existing, undefined);
    });

    it('credits an existing pool (positive delta) and saves it', async () => {
      const existing = buildCurrencyPool({ userId: USER_ID, currency: Currency.USD, balance: 100 });
      repo.findByUserIdAndCurrency.mockResolvedValue(existing);

      const result = await service.applyDelta(USER_ID, Currency.USD, 50);

      expect(result.balance).toBe(150);
    });

    it('passes pessimistic_write lock + manager to the repo find call', async () => {
      const existing = buildCurrencyPool({ userId: USER_ID });
      repo.findByUserIdAndCurrency.mockResolvedValue(existing);
      const manager = { tx: true } as unknown as Parameters<CurrencyPoolService['applyDelta']>[3];

      await service.applyDelta(USER_ID, Currency.PEN, 1, manager);

      expect(repo.findByUserIdAndCurrency).toHaveBeenCalledWith(USER_ID, Currency.PEN, {
        lock: 'pessimistic_write',
        manager,
      });
    });

    it('forwards the same manager to repo.save (so the write joins the transaction)', async () => {
      const existing = buildCurrencyPool({ userId: USER_ID });
      repo.findByUserIdAndCurrency.mockResolvedValue(existing);
      const manager = { tx: true } as unknown as Parameters<CurrencyPoolService['applyDelta']>[3];

      await service.applyDelta(USER_ID, Currency.PEN, 1, manager);

      expect(repo.save).toHaveBeenCalledWith(existing, manager);
    });
  });

  describe('applyDelta — pool does NOT exist (auto-create on first delta)', () => {
    it('creates a pool with balance=0 and then applies the delta', async () => {
      repo.findByUserIdAndCurrency.mockResolvedValue(null);

      const result = await service.applyDelta(USER_ID, Currency.EUR, 200);

      expect(result.userId).toBe(USER_ID);
      expect(result.currency).toBe(Currency.EUR);
      // Started at 0, applied +200 → 200.
      expect(result.balance).toBe(200);
    });

    it('persists the freshly-built pool via the repo (with manager if provided)', async () => {
      repo.findByUserIdAndCurrency.mockResolvedValue(null);
      const manager = { tx: true } as unknown as Parameters<CurrencyPoolService['applyDelta']>[3];

      await service.applyDelta(USER_ID, Currency.PEN, 10, manager);

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, currency: Currency.PEN, balance: 10 }),
        manager,
      );
    });

    it('handles a negative first-ever delta (debit before any credit) — balance goes negative', async () => {
      repo.findByUserIdAndCurrency.mockResolvedValue(null);

      const result = await service.applyDelta(USER_ID, Currency.PEN, -50);

      // The pool is allowed to go negative — single-user-prod, no business
      // rule says "block at zero". Audit gate (POOL_001, A1-B.2) catches drift.
      expect(result.balance).toBe(-50);
    });
  });

  describe('logging', () => {
    it('logs the delta event with the resulting balance', async () => {
      const existing = buildCurrencyPool({ userId: USER_ID, balance: 100 });
      repo.findByUserIdAndCurrency.mockResolvedValue(existing);

      await service.applyDelta(USER_ID, Currency.PEN, 25);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'currency_pool.delta_applied',
          userId: USER_ID,
          currency: Currency.PEN,
          delta: 25,
          balanceAfter: 125,
          created: false,
        }),
        'currency_pool.delta_applied',
      );
    });

    it('marks `created: true` in the log when the pool was auto-created', async () => {
      repo.findByUserIdAndCurrency.mockResolvedValue(null);

      await service.applyDelta(USER_ID, Currency.USD, 10);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ created: true }),
        'currency_pool.delta_applied',
      );
    });
  });
});
