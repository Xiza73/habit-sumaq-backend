import { type DomainException } from '@common/exceptions/domain.exception';
import { makeBudget } from '@modules/budgets/domain/__tests__/budget.factory';
import { type BudgetRepository } from '@modules/budgets/domain/budget.repository';

import { buildBudgetMovement } from '../../../domain/__tests__/budget-movement.factory';
import { type BudgetMovementRepository } from '../../../domain/budget-movement.repository';
import { ListBudgetMovementsUseCase } from '../list-budget-movements.use-case';

describe('ListBudgetMovementsUseCase', () => {
  let repo: jest.Mocked<BudgetMovementRepository>;
  let budgetRepo: jest.Mocked<BudgetRepository>;
  let useCase: ListBudgetMovementsUseCase;

  const USER = 'user-1';
  const BUDGET = 'budget-1';

  beforeEach(() => {
    repo = {
      findByBudgetId: jest.fn(),
      findById: jest.fn(),
      sumByBudgetId: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    budgetRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByPeriodAndCurrency: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new ListBudgetMovementsUseCase(repo, budgetRepo);
  });

  it('lists movements when budget exists and belongs to the user', async () => {
    budgetRepo.findById.mockResolvedValue(makeBudget({ id: BUDGET, userId: USER }));
    const movements = [buildBudgetMovement({ budgetId: BUDGET })];
    repo.findByBudgetId.mockResolvedValue(movements);

    const result = await useCase.execute(USER, BUDGET);

    expect(result).toBe(movements);
    expect(repo.findByBudgetId).toHaveBeenCalledWith(BUDGET);
  });

  it('throws BUDGET_NOT_FOUND when the budget does not exist', async () => {
    budgetRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(USER, BUDGET)).rejects.toMatchObject({
      code: 'BUDGET_NOT_FOUND',
    } satisfies Partial<DomainException>);
    expect(repo.findByBudgetId).not.toHaveBeenCalled();
  });

  it('throws BUDGET_NOT_FOUND when the budget is soft-deleted', async () => {
    budgetRepo.findById.mockResolvedValue(makeBudget({ userId: USER, deletedAt: new Date() }));
    await expect(useCase.execute(USER, BUDGET)).rejects.toMatchObject({
      code: 'BUDGET_NOT_FOUND',
    } satisfies Partial<DomainException>);
  });

  it('throws BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER on cross-user budget access', async () => {
    budgetRepo.findById.mockResolvedValue(makeBudget({ id: BUDGET, userId: 'someone-else' }));
    await expect(useCase.execute(USER, BUDGET)).rejects.toMatchObject({
      code: 'BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER',
    } satisfies Partial<DomainException>);
  });
});
