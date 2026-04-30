import { DomainException } from '@common/exceptions/domain.exception';

import { makeBudget } from '../../domain/__tests__/budget.factory';
import { type BudgetRepository } from '../../domain/budget.repository';

import { UpdateBudgetUseCase } from './update-budget.use-case';

describe('UpdateBudgetUseCase', () => {
  let useCase: UpdateBudgetUseCase;
  let repo: jest.Mocked<BudgetRepository>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByPeriodAndCurrency: jest.fn(),
      save: jest.fn().mockImplementation((b) => Promise.resolve(b)),
      softDelete: jest.fn(),
    };
    useCase = new UpdateBudgetUseCase(repo);
  });

  it('updates the amount', async () => {
    const budget = makeBudget({ userId: 'user-1', amount: 1000 });
    repo.findById.mockResolvedValue(budget);
    const result = await useCase.execute(budget.id, 'user-1', { amount: 2500 });
    expect(result.amount).toBe(2500);
    expect(repo.save).toHaveBeenCalled();
  });

  it('throws BUDGET_NOT_FOUND when the budget belongs to another user', async () => {
    const budget = makeBudget({ userId: 'someone-else' });
    repo.findById.mockResolvedValue(budget);
    await expect(useCase.execute(budget.id, 'user-1', { amount: 100 })).rejects.toMatchObject({
      code: 'BUDGET_NOT_FOUND',
    });
  });

  it('throws BUDGET_NOT_FOUND when the budget does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing', 'user-1', { amount: 100 })).rejects.toThrow(
      DomainException,
    );
  });

  it('throws BUDGET_NOT_FOUND when the budget is soft-deleted', async () => {
    const budget = makeBudget({ userId: 'user-1', deletedAt: new Date() });
    repo.findById.mockResolvedValue(budget);
    await expect(useCase.execute(budget.id, 'user-1', { amount: 100 })).rejects.toMatchObject({
      code: 'BUDGET_NOT_FOUND',
    });
  });
});
