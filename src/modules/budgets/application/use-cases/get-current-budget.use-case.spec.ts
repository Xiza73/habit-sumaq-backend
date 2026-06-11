import { buildBudgetMovement } from '@modules/budget-movements/domain/__tests__/budget-movement.factory';
import { type BudgetMovementRepository } from '@modules/budget-movements/domain/budget-movement.repository';

import { makeBudget } from '../../domain/__tests__/budget.factory';
import { type BudgetRepository } from '../../domain/budget.repository';

import { GetCurrentBudgetUseCase } from './get-current-budget.use-case';

describe('GetCurrentBudgetUseCase', () => {
  let useCase: GetCurrentBudgetUseCase;
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

    // v1.0.0: the use case reads movements + spent from the new
    // `budget_movements` module. Legacy `transactions` is no longer
    // consulted — the dashboard would silently show stale data if it
    // still was.
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

    useCase = new GetCurrentBudgetUseCase(budgetRepo, budgetMovementRepo);
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
    budgetMovementRepo.sumByBudgetId.mockResolvedValue(600);
    budgetMovementRepo.findByBudgetId.mockResolvedValue([
      buildBudgetMovement({ budgetId: budget.id }),
    ]);

    const result = await useCase.execute('user-1', 'PEN', 'America/Lima');
    expect(result).not.toBeNull();
    expect(result!.budget.id).toBe(budget.id);
    expect(result!.kpi.spent).toBe(600);
    expect(result!.kpi.remaining).toBe(900);
    expect(result!.movements).toHaveLength(1);
    jest.useRealTimers();
  });
});
