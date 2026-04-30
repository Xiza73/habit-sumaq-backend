import { buildTransaction } from '@modules/transactions/domain/__tests__/transaction.factory';
import { type TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { makeBudget } from '../../domain/__tests__/budget.factory';
import { type BudgetRepository } from '../../domain/budget.repository';

import { GetCurrentBudgetUseCase } from './get-current-budget.use-case';

describe('GetCurrentBudgetUseCase', () => {
  let useCase: GetCurrentBudgetUseCase;
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

    useCase = new GetCurrentBudgetUseCase(budgetRepo, txRepo);
  });

  it('returns null when no budget exists for current month + currency', async () => {
    budgetRepo.findByPeriodAndCurrency.mockResolvedValue(null);
    const result = await useCase.execute('user-1', 'PEN', 'America/Lima');
    expect(result).toBeNull();
  });

  it('uses current year+month from the client timezone to look up the budget', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-15T17:00:00.000Z'));
    budgetRepo.findByPeriodAndCurrency.mockResolvedValue(null);
    await useCase.execute('user-1', 'PEN', 'America/Lima');
    expect(budgetRepo.findByPeriodAndCurrency).toHaveBeenCalledWith('user-1', 2026, 4, 'PEN');
    jest.useRealTimers();
  });

  it('returns budget + KPI + movements when found', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-15T17:00:00.000Z'));
    const budget = makeBudget({ userId: 'user-1', amount: 1500 });
    budgetRepo.findByPeriodAndCurrency.mockResolvedValue(budget);
    txRepo.sumAmountByBudgetId.mockResolvedValue(600);
    txRepo.findByBudgetId.mockResolvedValue([buildTransaction({ budgetId: budget.id })]);

    const result = await useCase.execute('user-1', 'PEN', 'America/Lima');
    expect(result).not.toBeNull();
    expect(result!.budget.id).toBe(budget.id);
    expect(result!.kpi.spent).toBe(600);
    expect(result!.kpi.remaining).toBe(900);
    expect(result!.movements).toHaveLength(1);
    jest.useRealTimers();
  });
});
