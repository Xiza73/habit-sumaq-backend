import { DomainException } from '@common/exceptions/domain.exception';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';
import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { buildTransaction } from '../../domain/__tests__/transaction.factory';
import { TransactionStatus } from '../../domain/enums/transaction-status.enum';
import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { type TransactionRepository } from '../../domain/transaction.repository';

import { DeleteTransactionUseCase } from './delete-transaction.use-case';

describe('DeleteTransactionUseCase', () => {
  let useCase: DeleteTransactionUseCase;
  let txRepo: jest.Mocked<TransactionRepository>;
  let accountRepo: jest.Mocked<AccountRepository>;

  const userId = 'user-1';

  beforeEach(() => {
    txRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByRelatedTransactionId: jest.fn().mockResolvedValue([]),
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

    useCase = new DeleteTransactionUseCase(txRepo, accountRepo);
  });

  it('should reverse expense (credit) and soft delete', async () => {
    const tx = buildTransaction({
      userId,
      accountId: 'acc-1',
      type: TransactionType.EXPENSE,
      amount: 80,
    });
    const account = buildAccount({ id: 'acc-1', userId, balance: 200 });

    txRepo.findById.mockResolvedValue(tx);
    accountRepo.findByIds.mockResolvedValue([account]);

    await useCase.execute(tx.id, userId);

    expect(account.balance).toBe(280); // 200 + 80 (reverse debit)
    expect(accountRepo.save).toHaveBeenCalledWith(account);
    expect(txRepo.softDelete).toHaveBeenCalledWith(tx.id);
  });

  it('should reverse income (debit) and soft delete', async () => {
    const tx = buildTransaction({
      userId,
      accountId: 'acc-1',
      type: TransactionType.INCOME,
      amount: 100,
    });
    const account = buildAccount({ id: 'acc-1', userId, balance: 500 });

    txRepo.findById.mockResolvedValue(tx);
    accountRepo.findByIds.mockResolvedValue([account]);

    await useCase.execute(tx.id, userId);

    expect(account.balance).toBe(400); // 500 - 100 (reverse credit)
  });

  it('should reverse transfer on both accounts', async () => {
    const tx = buildTransaction({
      userId,
      accountId: 'acc-1',
      type: TransactionType.TRANSFER,
      amount: 100,
      destinationAccountId: 'acc-2',
    });
    const source = buildAccount({ id: 'acc-1', userId, balance: 300, currency: Currency.PEN });
    const dest = buildAccount({ id: 'acc-2', userId, balance: 200, currency: Currency.PEN });

    txRepo.findById.mockResolvedValue(tx);
    accountRepo.findByIds.mockResolvedValue([source, dest]);

    await useCase.execute(tx.id, userId);

    expect(source.balance).toBe(400); // 300 + 100
    expect(dest.balance).toBe(100); // 200 - 100
  });

  it('should throw TRANSACTION_NOT_FOUND if not found', async () => {
    txRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('x', userId)).rejects.toThrow(DomainException);
  });

  it('should throw TRANSACTION_BELONGS_TO_OTHER_USER if not owned', async () => {
    const tx = buildTransaction({ userId: 'other-user' });
    txRepo.findById.mockResolvedValue(tx);
    await expect(useCase.execute(tx.id, userId)).rejects.toThrow(DomainException);
  });

  it('should delete DEBT and cascade delete all settlements reversing their balances', async () => {
    const debt = buildTransaction({
      id: 'debt-1',
      userId,
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 40,
      status: TransactionStatus.PENDING,
    });
    const settlement = buildTransaction({
      id: 'settle-1',
      userId,
      accountId: 'acc-1',
      type: TransactionType.EXPENSE,
      amount: 60,
      relatedTransactionId: 'debt-1',
    });
    const settlement2 = buildTransaction({
      id: 'settle-2',
      userId,
      accountId: 'acc-1',
      type: TransactionType.EXPENSE,
      amount: 20,
      relatedTransactionId: 'debt-1',
    });
    const account = buildAccount({ id: 'acc-1', userId, balance: 200 });

    txRepo.findById.mockResolvedValue(debt);
    txRepo.findByRelatedTransactionId.mockResolvedValue([settlement, settlement2]);
    accountRepo.findByIds.mockResolvedValue([account]);

    await useCase.execute('debt-1', userId);

    expect(account.balance).toBe(280); // 200 + 60 + 20 (reversed expense)
    expect(txRepo.softDelete).toHaveBeenCalledWith('settle-1');
    expect(txRepo.softDelete).toHaveBeenCalledWith('debt-1');
  });

  it('should delete a settlement and revert the original DEBT remainingAmount', async () => {
    const debt = buildTransaction({
      id: 'debt-1',
      userId,
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 40,
      status: TransactionStatus.PENDING,
    });
    const settlement = buildTransaction({
      id: 'settle-1',
      userId,
      accountId: 'acc-1',
      type: TransactionType.EXPENSE,
      amount: 60,
      relatedTransactionId: 'debt-1',
    });
    const account = buildAccount({ id: 'acc-1', userId, balance: 200 });

    txRepo.findById.mockImplementation((id) => {
      if (id === 'settle-1') return Promise.resolve(settlement);
      if (id === 'debt-1') return Promise.resolve(debt);
      return Promise.resolve(null);
    });
    accountRepo.findByIds.mockResolvedValue([account]);

    await useCase.execute('settle-1', userId);

    expect(debt.remainingAmount).toBe(100); // 40 + 60 reverted
    expect(debt.status).toBe(TransactionStatus.PENDING);
    expect(account.balance).toBe(260); // 200 + 60 reversed
    expect(txRepo.save).toHaveBeenCalledWith(debt);
    expect(txRepo.softDelete).toHaveBeenCalledWith('settle-1');
  });
});
