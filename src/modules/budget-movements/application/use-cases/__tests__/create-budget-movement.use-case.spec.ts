import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';
import { makeBudget } from '@modules/budgets/domain/__tests__/budget.factory';
import { type BudgetRepository } from '@modules/budgets/domain/budget.repository';
import { type CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { type BudgetMovementRepository } from '../../../domain/budget-movement.repository';
import { CreateBudgetMovementUseCase } from '../create-budget-movement.use-case';

describe('CreateBudgetMovementUseCase', () => {
  let repo: jest.Mocked<BudgetMovementRepository>;
  let budgetRepo: jest.Mocked<BudgetRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: CreateBudgetMovementUseCase;
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
    useCase = new CreateBudgetMovementUseCase(
      repo,
      budgetRepo,
      pool,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  describe('guards', () => {
    it('throws BUDGET_NOT_FOUND when the budget does not exist', async () => {
      budgetRepo.findById.mockResolvedValue(null);
      await expect(
        useCase.execute(USER, {
          budgetId: BUDGET,
          amount: 50,
          date: '2026-06-15T12:00:00.000Z',
        }),
      ).rejects.toMatchObject({ code: 'BUDGET_NOT_FOUND' } satisfies Partial<DomainException>);
    });

    it('throws BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER for cross-user budget', async () => {
      budgetRepo.findById.mockResolvedValue(
        makeBudget({ id: BUDGET, userId: 'someone-else', year: 2026, month: 6 }),
      );
      await expect(
        useCase.execute(USER, {
          budgetId: BUDGET,
          amount: 50,
          date: '2026-06-15T12:00:00.000Z',
        }),
      ).rejects.toMatchObject({
        code: 'BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER',
      } satisfies Partial<DomainException>);
    });

    it('throws BUDGET_MOVEMENT_DATE_OUT_OF_BUDGET_RANGE when date is outside the month', async () => {
      budgetRepo.findById.mockResolvedValue(
        makeBudget({ id: BUDGET, userId: USER, year: 2026, month: 6 }),
      );
      await expect(
        useCase.execute(USER, {
          budgetId: BUDGET,
          amount: 50,
          date: '2026-07-01T00:00:00.000Z',
        }),
      ).rejects.toMatchObject({
        code: 'BUDGET_MOVEMENT_DATE_OUT_OF_BUDGET_RANGE',
      } satisfies Partial<DomainException>);
    });
  });

  describe('happy path', () => {
    beforeEach(() => {
      budgetRepo.findById.mockResolvedValue(
        makeBudget({
          id: BUDGET,
          userId: USER,
          year: 2026,
          month: 6,
          currency: Currency.PEN,
        }),
      );
    });

    it('persists the movement and applies a NEGATIVE pool delta of `amount`', async () => {
      await useCase.execute(USER, {
        budgetId: BUDGET,
        amount: 75,
        date: '2026-06-15T12:00:00.000Z',
      });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -75, FAKE_MGR);
      expect(repo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
    });

    it('inherits currency from the budget, NOT the DTO', async () => {
      const result = await useCase.execute(USER, {
        budgetId: BUDGET,
        amount: 50,
        date: '2026-06-15T12:00:00.000Z',
      });
      expect(result.currency).toBe(Currency.PEN);
    });

    it('defaults the date to now when omitted', async () => {
      // We need a "now" that's inside June 2026 for the test to pass; we
      // build the budget for the current real month so containsDate
      // always matches. The test guards against the use case not
      // honoring the default branch.
      const now = new Date();
      budgetRepo.findById.mockResolvedValue(
        makeBudget({
          id: BUDGET,
          userId: USER,
          year: now.getUTCFullYear(),
          month: now.getUTCMonth() + 1,
          currency: Currency.PEN,
        }),
      );
      const result = await useCase.execute(USER, { budgetId: BUDGET, amount: 50 });
      expect(result.date.getUTCFullYear()).toBe(now.getUTCFullYear());
    });

    it('logs the creation event', async () => {
      await useCase.execute(USER, {
        budgetId: BUDGET,
        amount: 30,
        date: '2026-06-10T00:00:00.000Z',
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'budget_movement.created',
          poolDelta: -30,
        }),
        'budget_movement.created',
      );
    });
  });
});
