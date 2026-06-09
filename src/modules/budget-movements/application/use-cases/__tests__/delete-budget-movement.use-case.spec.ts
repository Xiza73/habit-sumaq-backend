import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';
import { type CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { buildBudgetMovement } from '../../../domain/__tests__/budget-movement.factory';
import { type BudgetMovementRepository } from '../../../domain/budget-movement.repository';
import { DeleteBudgetMovementUseCase } from '../delete-budget-movement.use-case';

describe('DeleteBudgetMovementUseCase', () => {
  let repo: jest.Mocked<BudgetMovementRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: DeleteBudgetMovementUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  const USER = 'user-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  beforeEach(() => {
    repo = {
      findByBudgetId: jest.fn(),
      findById: jest.fn(),
      sumByBudgetId: jest.fn(),
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
    useCase = new DeleteBudgetMovementUseCase(
      repo,
      pool,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  describe('guards', () => {
    it('throws BUDGET_MOVEMENT_NOT_FOUND when missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(useCase.execute('x', USER)).rejects.toMatchObject({
        code: 'BUDGET_MOVEMENT_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws BUDGET_MOVEMENT_NOT_FOUND when already soft-deleted', async () => {
      repo.findById.mockResolvedValue(buildBudgetMovement({ userId: USER, deletedAt: new Date() }));
      await expect(useCase.execute('x', USER)).rejects.toMatchObject({
        code: 'BUDGET_MOVEMENT_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER on cross-user', async () => {
      repo.findById.mockResolvedValue(buildBudgetMovement({ userId: 'other' }));
      await expect(useCase.execute('x', USER)).rejects.toMatchObject({
        code: 'BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER',
      } satisfies Partial<DomainException>);
    });
  });

  it('soft-deletes the row AND refunds the pool by amount, atomically', async () => {
    const m = buildBudgetMovement({
      userId: USER,
      amount: 75,
      currency: Currency.PEN,
    });
    repo.findById.mockResolvedValue(m);

    await useCase.execute(m.id, USER);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(repo.softDelete).toHaveBeenCalledWith(m.id, FAKE_MGR);
    // Refund: +amount (positive delta brings money back to the pool).
    expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, 75, FAKE_MGR);
  });

  it('logs the deletion event with the refund amount', async () => {
    const m = buildBudgetMovement({ userId: USER, amount: 50, currency: Currency.PEN });
    repo.findById.mockResolvedValue(m);

    await useCase.execute(m.id, USER);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'budget_movement.deleted',
        refundAmount: 50,
      }),
      'budget_movement.deleted',
    );
  });
});
