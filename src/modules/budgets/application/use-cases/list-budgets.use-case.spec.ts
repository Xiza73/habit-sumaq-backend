import { makeBudget } from '../../domain/__tests__/budget.factory';
import { type BudgetRepository } from '../../domain/budget.repository';

import { ListBudgetsUseCase } from './list-budgets.use-case';

describe('ListBudgetsUseCase', () => {
  it('returns all budgets for the user from the repository', async () => {
    const repo: jest.Mocked<BudgetRepository> = {
      findByUserId: jest.fn().mockResolvedValue([makeBudget(), makeBudget()]),
      findById: jest.fn(),
      findByPeriodAndCurrency: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    const useCase = new ListBudgetsUseCase(repo);
    const result = await useCase.execute('user-1');
    expect(result).toHaveLength(2);
    expect(repo.findByUserId).toHaveBeenCalledWith('user-1');
  });
});
