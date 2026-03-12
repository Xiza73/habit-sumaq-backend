import { DomainException } from '@common/exceptions/domain.exception';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';
import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { buildTransaction } from '../../domain/__tests__/transaction.factory';
import { TransactionStatus } from '../../domain/enums/transaction-status.enum';
import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { type TransactionRepository } from '../../domain/transaction.repository';

import { UpdateTransactionUseCase } from './update-transaction.use-case';

describe('UpdateTransactionUseCase', () => {
  let useCase: UpdateTransactionUseCase;
  let txRepo: jest.Mocked<TransactionRepository>;
  let accountRepo: jest.Mocked<AccountRepository>;

  const userId = 'user-1';

  beforeEach(() => {
    txRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByRelatedTransactionId: jest.fn(),
      save: jest.fn().mockImplementation((tx) => Promise.resolve(tx)),
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

    useCase = new UpdateTransactionUseCase(txRepo, accountRepo);
  });

  it('should update description without touching balance', async () => {
    const tx = buildTransaction({ userId, amount: 100 });
    txRepo.findById.mockResolvedValue(tx);

    const result = await useCase.execute(tx.id, userId, { description: 'Cena' });

    expect(result.description).toBe('Cena');
    expect(accountRepo.findById).not.toHaveBeenCalled();
  });

  it('should reverse old balance and apply new when amount changes (expense)', async () => {
    const tx = buildTransaction({
      userId,
      accountId: 'acc-1',
      type: TransactionType.EXPENSE,
      amount: 100,
    });
    const account = buildAccount({ id: 'acc-1', userId, balance: 400 });
    txRepo.findById.mockResolvedValue(tx);
    accountRepo.findById.mockResolvedValue(account);

    await useCase.execute(tx.id, userId, { amount: 150 });

    // 400 + 100 (reverse old debit) - 150 (apply new debit) = 350
    expect(account.balance).toBe(350);
  });

  it('should reverse old balance and apply new when amount changes (income)', async () => {
    const tx = buildTransaction({
      userId,
      accountId: 'acc-1',
      type: TransactionType.INCOME,
      amount: 200,
    });
    const account = buildAccount({ id: 'acc-1', userId, balance: 500 });
    txRepo.findById.mockResolvedValue(tx);
    accountRepo.findById.mockResolvedValue(account);

    await useCase.execute(tx.id, userId, { amount: 300 });

    // 500 - 200 (reverse old credit) + 300 (apply new credit) = 600
    expect(account.balance).toBe(600);
  });

  it('should adjust both accounts for transfer amount change', async () => {
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

    await useCase.execute(tx.id, userId, { amount: 150 });

    // source: 300 + 100 (reverse) - 150 (new) = 250
    expect(source.balance).toBe(250);
    // dest: 200 - 100 (reverse) + 150 (new) = 250
    expect(dest.balance).toBe(250);
  });

  it('should throw TRANSACTION_NOT_FOUND if not found', async () => {
    txRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId, { amount: 50 })).rejects.toThrow(DomainException);
  });

  it('should throw TRANSACTION_BELONGS_TO_OTHER_USER if not owned', async () => {
    const tx = buildTransaction({ userId: 'other-user' });
    txRepo.findById.mockResolvedValue(tx);

    await expect(useCase.execute(tx.id, userId, { amount: 50 })).rejects.toThrow(DomainException);
  });

  it('should throw CANNOT_UPDATE_SETTLED_TRANSACTION for settled DEBT', async () => {
    const tx = buildTransaction({
      userId,
      type: TransactionType.DEBT,
      status: TransactionStatus.SETTLED,
      remainingAmount: 0,
    });
    txRepo.findById.mockResolvedValue(tx);

    await expect(useCase.execute(tx.id, userId, { description: 'new' })).rejects.toThrow(
      'No se puede modificar una transacción liquidada',
    );
  });

  it('should update reference on any transaction', async () => {
    const tx = buildTransaction({ userId });
    txRepo.findById.mockResolvedValue(tx);

    const result = await useCase.execute(tx.id, userId, { reference: 'Pedro' });

    expect(result.reference).toBe('Pedro');
  });

  it('should update remainingAmount proportionally when amount changes on DEBT', async () => {
    const tx = buildTransaction({
      userId,
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 60,
      status: TransactionStatus.PENDING,
    });
    txRepo.findById.mockResolvedValue(tx);

    const result = await useCase.execute(tx.id, userId, { amount: 120 });

    // remainingAmount: 60 + (120 - 100) = 80
    expect(result.remainingAmount).toBe(80);
    expect(result.amount).toBe(120);
    expect(accountRepo.findById).not.toHaveBeenCalled(); // no balance effect
  });
});
