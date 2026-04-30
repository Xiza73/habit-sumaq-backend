import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { type TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { makeBudget } from '../../domain/__tests__/budget.factory';
import { type BudgetRepository } from '../../domain/budget.repository';

import { DeleteBudgetUseCase } from './delete-budget.use-case';

describe('DeleteBudgetUseCase', () => {
  let useCase: DeleteBudgetUseCase;
  let budgetRepo: jest.Mocked<BudgetRepository>;
  let txRepo: jest.Mocked<TransactionRepository>;

  beforeEach(() => {
    budgetRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByPeriodAndCurrency: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn().mockResolvedValue(undefined),
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
      findByBudgetId: jest.fn(),
      sumAmountByBudgetId: jest.fn(),
      clearBudgetIdForBudget: jest.fn().mockResolvedValue(undefined),
    };

    const logger = buildMockPinoLogger();
    useCase = new DeleteBudgetUseCase(budgetRepo, txRepo, logger as unknown as PinoLogger);
  });

  it('clears budgetId on linked transactions BEFORE soft-deleting the budget', async () => {
    const budget = makeBudget({ userId: 'user-1' });
    budgetRepo.findById.mockResolvedValue(budget);

    const callOrder: string[] = [];
    txRepo.clearBudgetIdForBudget.mockImplementation(() => {
      callOrder.push('clear');
      return Promise.resolve();
    });
    budgetRepo.softDelete.mockImplementation(() => {
      callOrder.push('softDelete');
      return Promise.resolve();
    });

    await useCase.execute(budget.id, 'user-1');

    expect(callOrder).toEqual(['clear', 'softDelete']);
    expect(txRepo.clearBudgetIdForBudget).toHaveBeenCalledWith(budget.id);
    expect(budgetRepo.softDelete).toHaveBeenCalledWith(budget.id);
  });

  it('throws BUDGET_NOT_FOUND when the budget belongs to another user', async () => {
    budgetRepo.findById.mockResolvedValue(makeBudget({ userId: 'someone-else' }));
    await expect(useCase.execute('id', 'user-1')).rejects.toMatchObject({
      code: 'BUDGET_NOT_FOUND',
    });
    expect(txRepo.clearBudgetIdForBudget).not.toHaveBeenCalled();
    expect(budgetRepo.softDelete).not.toHaveBeenCalled();
  });

  it('throws BUDGET_NOT_FOUND when the budget does not exist', async () => {
    budgetRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('id', 'user-1')).rejects.toMatchObject({
      code: 'BUDGET_NOT_FOUND',
    });
  });
});
