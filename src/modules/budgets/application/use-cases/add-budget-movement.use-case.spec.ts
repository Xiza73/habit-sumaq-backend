import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';
import { Currency } from '@modules/accounts/domain/enums/currency.enum';
import { buildCategory } from '@modules/categories/domain/__tests__/category.factory';
import { type CategoryRepository } from '@modules/categories/domain/category.repository';
import { TransactionType } from '@modules/transactions/domain/enums/transaction-type.enum';
import { type TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { makeBudget } from '../../domain/__tests__/budget.factory';
import { type BudgetRepository } from '../../domain/budget.repository';

import { AddBudgetMovementUseCase } from './add-budget-movement.use-case';

describe('AddBudgetMovementUseCase', () => {
  let useCase: AddBudgetMovementUseCase;
  let budgetRepo: jest.Mocked<BudgetRepository>;
  let txRepo: jest.Mocked<TransactionRepository>;
  let accountRepo: jest.Mocked<AccountRepository>;
  let categoryRepo: jest.Mocked<CategoryRepository>;

  const userId = 'user-1';
  const baseDto = {
    amount: 50,
    accountId: 'acc-1',
    categoryId: 'cat-1',
    date: new Date('2026-04-15T12:00:00.000Z'),
    description: 'Cena',
  };

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
      save: jest.fn().mockImplementation((tx) => Promise.resolve(tx)),
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
      clearBudgetIdForBudget: jest.fn(),
    };

    accountRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
      softDelete: jest.fn(),
    };

    categoryRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    const logger = buildMockPinoLogger();
    useCase = new AddBudgetMovementUseCase(
      budgetRepo,
      txRepo,
      accountRepo,
      categoryRepo,
      logger as unknown as PinoLogger,
    );
  });

  it('creates an EXPENSE transaction tagged with budgetId, debits the account', async () => {
    const budget = makeBudget({ userId, year: 2026, month: 4, currency: 'PEN', amount: 1000 });
    const account = buildAccount({ id: 'acc-1', userId, currency: Currency.PEN, balance: 800 });
    const category = buildCategory({ id: 'cat-1', userId });
    budgetRepo.findById.mockResolvedValue(budget);
    accountRepo.findById.mockResolvedValue(account);
    categoryRepo.findById.mockResolvedValue(category);

    const { transaction } = await useCase.execute(budget.id, userId, baseDto);

    expect(transaction.type).toBe(TransactionType.EXPENSE);
    expect(transaction.budgetId).toBe(budget.id);
    expect(transaction.amount).toBe(50);
    expect(account.balance).toBe(750); // 800 - 50
    expect(accountRepo.save).toHaveBeenCalled();
    expect(txRepo.save).toHaveBeenCalled();
  });

  it('throws CURRENCY_MISMATCH when the account currency differs from the budget', async () => {
    const budget = makeBudget({ userId, currency: 'PEN' });
    const account = buildAccount({ id: 'acc-1', userId, currency: Currency.USD });
    budgetRepo.findById.mockResolvedValue(budget);
    accountRepo.findById.mockResolvedValue(account);

    await expect(useCase.execute(budget.id, userId, baseDto)).rejects.toMatchObject({
      code: 'CURRENCY_MISMATCH',
    });
    expect(accountRepo.save).not.toHaveBeenCalled();
    expect(txRepo.save).not.toHaveBeenCalled();
  });

  it('throws MOVEMENT_DATE_OUT_OF_RANGE when date falls outside the budget month', async () => {
    const budget = makeBudget({ userId, year: 2026, month: 4, currency: 'PEN' });
    const account = buildAccount({ id: 'acc-1', userId, currency: Currency.PEN });
    const category = buildCategory({ id: 'cat-1', userId });
    budgetRepo.findById.mockResolvedValue(budget);
    accountRepo.findById.mockResolvedValue(account);
    categoryRepo.findById.mockResolvedValue(category);

    await expect(
      useCase.execute(budget.id, userId, {
        ...baseDto,
        date: new Date('2026-05-01T12:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'MOVEMENT_DATE_OUT_OF_RANGE' });
    expect(txRepo.save).not.toHaveBeenCalled();
  });

  it('throws ACCOUNT_NOT_FOUND when the account belongs to another user', async () => {
    const budget = makeBudget({ userId });
    const account = buildAccount({ id: 'acc-1', userId: 'someone-else' });
    budgetRepo.findById.mockResolvedValue(budget);
    accountRepo.findById.mockResolvedValue(account);

    await expect(useCase.execute(budget.id, userId, baseDto)).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
  });

  it('throws CATEGORY_NOT_FOUND when the category belongs to another user', async () => {
    const budget = makeBudget({ userId, currency: 'PEN' });
    const account = buildAccount({ id: 'acc-1', userId, currency: Currency.PEN });
    const category = buildCategory({ id: 'cat-1', userId: 'someone-else' });
    budgetRepo.findById.mockResolvedValue(budget);
    accountRepo.findById.mockResolvedValue(account);
    categoryRepo.findById.mockResolvedValue(category);

    await expect(useCase.execute(budget.id, userId, baseDto)).rejects.toMatchObject({
      code: 'CATEGORY_NOT_FOUND',
    });
  });

  it('throws BUDGET_NOT_FOUND when the budget belongs to another user', async () => {
    budgetRepo.findById.mockResolvedValue(makeBudget({ userId: 'someone-else' }));
    await expect(useCase.execute('id', userId, baseDto)).rejects.toMatchObject({
      code: 'BUDGET_NOT_FOUND',
    });
  });
});
