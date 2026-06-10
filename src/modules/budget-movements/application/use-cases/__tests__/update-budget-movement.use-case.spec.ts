import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';
import { makeBudget } from '@modules/budgets/domain/__tests__/budget.factory';
import { type BudgetRepository } from '@modules/budgets/domain/budget.repository';
import { type CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { buildBudgetMovement } from '../../../domain/__tests__/budget-movement.factory';
import { type BudgetMovementRepository } from '../../../domain/budget-movement.repository';
import { UpdateBudgetMovementUseCase } from '../update-budget-movement.use-case';

describe('UpdateBudgetMovementUseCase', () => {
  let repo: jest.Mocked<BudgetMovementRepository>;
  let budgetRepo: jest.Mocked<BudgetRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: UpdateBudgetMovementUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  const USER = 'user-1';
  const BUDGET = 'budget-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  beforeEach(() => {
    repo = {
      findByBudgetId: jest.fn(),
      findById: jest.fn(),
      sumByBudgetId: jest.fn(),
      sumByCurrencyInRange: jest.fn(),
      topCategoriesByCurrencyInRange: jest.fn(),
      dailyByCurrencyInRange: jest.fn(),
      save: jest.fn().mockImplementation((m) => Promise.resolve(m)),
      softDelete: jest.fn(),
    };
    budgetRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByPeriodAndCurrency: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    pool = { applyDelta: jest.fn() } as unknown as jest.Mocked<CurrencyPoolService>;
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };
    logger = buildMockPinoLogger();
    useCase = new UpdateBudgetMovementUseCase(
      repo,
      budgetRepo,
      pool,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  describe('guards', () => {
    it('throws BUDGET_MOVEMENT_NOT_FOUND when missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(useCase.execute('x', USER, { amount: 80 })).rejects.toMatchObject({
        code: 'BUDGET_MOVEMENT_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER for cross-user', async () => {
      repo.findById.mockResolvedValue(buildBudgetMovement({ userId: 'other' }));
      await expect(useCase.execute('x', USER, { amount: 80 })).rejects.toMatchObject({
        code: 'BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER',
      } satisfies Partial<DomainException>);
    });

    it('throws BUDGET_MOVEMENT_DATE_OUT_OF_BUDGET_RANGE when new date is outside the budget month', async () => {
      repo.findById.mockResolvedValue(
        buildBudgetMovement({
          userId: USER,
          budgetId: BUDGET,
          date: new Date('2026-06-15T00:00:00.000Z'),
        }),
      );
      budgetRepo.findById.mockResolvedValue(
        makeBudget({ id: BUDGET, userId: USER, year: 2026, month: 6 }),
      );
      await expect(
        useCase.execute('x', USER, { date: '2026-07-01T00:00:00.000Z' }),
      ).rejects.toMatchObject({
        code: 'BUDGET_MOVEMENT_DATE_OUT_OF_BUDGET_RANGE',
      } satisfies Partial<DomainException>);
    });
  });

  describe('pure metadata update (amount unchanged)', () => {
    it('skips the tx wrapper and does NOT call applyDelta', async () => {
      repo.findById.mockResolvedValue(
        buildBudgetMovement({ userId: USER, budgetId: BUDGET, amount: 100 }),
      );
      await useCase.execute('x', USER, { description: 'new desc' });

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(pool.applyDelta).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('amount change → pool delta', () => {
    it('amount UP: applyDelta is NEGATIVE (extra debit)', async () => {
      repo.findById.mockResolvedValue(
        buildBudgetMovement({
          userId: USER,
          budgetId: BUDGET,
          amount: 100,
          currency: Currency.PEN,
        }),
      );
      await useCase.execute('x', USER, { amount: 130 });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      // oldAmount (100) - newAmount (130) = -30 → debit of 30
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -30, FAKE_MGR);
    });

    it('amount DOWN: applyDelta is POSITIVE (refund of difference)', async () => {
      repo.findById.mockResolvedValue(
        buildBudgetMovement({
          userId: USER,
          budgetId: BUDGET,
          amount: 100,
          currency: Currency.PEN,
        }),
      );
      await useCase.execute('x', USER, { amount: 70 });

      // oldAmount (100) - newAmount (70) = +30 → refund of 30
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, 30, FAKE_MGR);
    });

    it('forwards the EntityManager to repo.save', async () => {
      repo.findById.mockResolvedValue(
        buildBudgetMovement({ userId: USER, budgetId: BUDGET, amount: 100 }),
      );
      await useCase.execute('x', USER, { amount: 120 });

      expect(repo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
    });

    it('logs with oldAmount + newAmount + poolDelta', async () => {
      repo.findById.mockResolvedValue(
        buildBudgetMovement({
          userId: USER,
          budgetId: BUDGET,
          amount: 100,
          currency: Currency.PEN,
        }),
      );
      await useCase.execute('x', USER, { amount: 80 });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'budget_movement.updated',
          amountChanged: true,
          oldAmount: 100,
          newAmount: 80,
          poolDelta: 20,
        }),
        'budget_movement.updated',
      );
    });
  });
});
