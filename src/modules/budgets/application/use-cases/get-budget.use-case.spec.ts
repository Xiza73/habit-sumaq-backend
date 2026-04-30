import { type TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { makeBudget } from '../../domain/__tests__/budget.factory';
import { type BudgetRepository } from '../../domain/budget.repository';

import { GetBudgetUseCase } from './get-budget.use-case';

describe('GetBudgetUseCase', () => {
  let useCase: GetBudgetUseCase;
  let budgetRepo: jest.Mocked<BudgetRepository>;
  let txRepo: jest.Mocked<TransactionRepository>;

  beforeEach(() => {
    budgetRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByPeriodAndCurrency: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    txRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByRelatedTransactionId: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      existsByAccountId: jest.fn(),
      aggregateDebtsByReference: jest.fn(),
      findPendingDebtOrLoanByNormalizedReference: jest.fn(),
      sumFlowByCurrencyInRange: jest.fn(),
      topExpenseCategoriesInRange: jest.fn(),
      dailyNetFlowInRange: jest.fn(),
      countByMonthlyServiceId: jest.fn(),
      findLastNByMonthlyServiceId: jest.fn(),
      findByBudgetId: jest.fn().mockResolvedValue([]),
      sumAmountByBudgetId: jest.fn().mockResolvedValue(0),
      clearBudgetIdForBudget: jest.fn(),
    };

    useCase = new GetBudgetUseCase(budgetRepo, txRepo);
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
    txRepo.sumAmountByBudgetId.mockResolvedValue(0);
    const result = await useCase.execute(budget.id, 'user-1', 'America/Lima');
    expect(result.budget.id).toBe(budget.id);
    expect(result.kpi).toBeDefined();
    expect(result.movements).toEqual([]);
  });
});
