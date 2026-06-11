import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';

import { makeBudget } from '../../domain/__tests__/budget.factory';
import { type BudgetRepository } from '../../domain/budget.repository';

import { DeleteBudgetUseCase } from './delete-budget.use-case';

describe('DeleteBudgetUseCase', () => {
  let useCase: DeleteBudgetUseCase;
  let budgetRepo: jest.Mocked<BudgetRepository>;

  beforeEach(() => {
    budgetRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByPeriodAndCurrency: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    const logger = buildMockPinoLogger();
    useCase = new DeleteBudgetUseCase(budgetRepo, logger as unknown as PinoLogger);
  });

  it('soft-deletes the budget', async () => {
    const budget = makeBudget({ userId: 'user-1' });
    budgetRepo.findById.mockResolvedValue(budget);

    await useCase.execute(budget.id, 'user-1');

    expect(budgetRepo.softDelete).toHaveBeenCalledWith(budget.id);
  });

  it('throws BUDGET_NOT_FOUND when the budget belongs to another user', async () => {
    budgetRepo.findById.mockResolvedValue(makeBudget({ userId: 'someone-else' }));
    await expect(useCase.execute('id', 'user-1')).rejects.toMatchObject({
      code: 'BUDGET_NOT_FOUND',
    });
    expect(budgetRepo.softDelete).not.toHaveBeenCalled();
  });

  it('throws BUDGET_NOT_FOUND when the budget does not exist', async () => {
    budgetRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('id', 'user-1')).rejects.toMatchObject({
      code: 'BUDGET_NOT_FOUND',
    });
  });
});
