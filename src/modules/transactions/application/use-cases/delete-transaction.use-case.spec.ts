import { DomainException } from '@common/exceptions/domain.exception';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';
import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { buildTransaction } from '../../domain/__tests__/transaction.factory';
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
      save: jest.fn(),
      softDelete: jest.fn(),
      existsByAccountId: jest.fn(),
    } as jest.Mocked<TransactionRepository>;

    accountRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
      softDelete: jest.fn(),
    } as jest.Mocked<AccountRepository>;

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
    accountRepo.findById.mockResolvedValue(account);

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
    accountRepo.findById.mockResolvedValue(account);

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
    accountRepo.findById.mockImplementation((id) => {
      if (id === 'acc-1') return Promise.resolve(source);
      if (id === 'acc-2') return Promise.resolve(dest);
      return Promise.resolve(null);
    });

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
});
