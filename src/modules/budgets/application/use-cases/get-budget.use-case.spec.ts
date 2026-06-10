import { type BudgetMovementRepository } from '@modules/budget-movements/domain/budget-movement.repository';

import { makeBudget } from '../../domain/__tests__/budget.factory';
import { type BudgetRepository } from '../../domain/budget.repository';

import { GetBudgetUseCase } from './get-budget.use-case';

describe('GetBudgetUseCase', () => {
  let useCase: GetBudgetUseCase;
  let budgetRepo: jest.Mocked<BudgetRepository>;
  let budgetMovementRepo: jest.Mocked<BudgetMovementRepository>;

  beforeEach(() => {
    budgetRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByPeriodAndCurrency: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    // v1.0.0: movements + spent come from `budget_movements`.
    budgetMovementRepo = {
      findByBudgetId: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      sumByBudgetId: jest.fn().mockResolvedValue(0),
      sumByCurrencyInRange: jest.fn(),
      topCategoriesByCurrencyInRange: jest.fn(),
      dailyByCurrencyInRange: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    useCase = new GetBudgetUseCase(budgetRepo, budgetMovementRepo);
  });

  it('throws BUDGET_NOT_FOUND when the budget belongs to another user', async () => {
    budgetRepo.findById.mockResolvedValue(makeBudget({ userId: 'someone-else' }));
    await expect(useCase.execute('id', 'user-1', 'America/Lima')).rejects.toMatchObject({
      code: 'BUDGET_NOT_FOUND',
    });
  });

  it('returns budget + KPI + movements for the owner', async () => {
    const budget = makeBudget({ userId: 'user-1' });
    budgetRepo.findById.mockResolvedValue(budget);
    budgetMovementRepo.sumByBudgetId.mockResolvedValue(0);
    const result = await useCase.execute(budget.id, 'user-1', 'America/Lima');
    expect(result.budget.id).toBe(budget.id);
    expect(result.kpi).toBeDefined();
    expect(result.movements).toEqual([]);
  });
});
