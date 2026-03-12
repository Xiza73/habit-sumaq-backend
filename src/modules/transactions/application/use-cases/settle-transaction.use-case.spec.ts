import { DomainException } from '@common/exceptions/domain.exception';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';

import { buildTransaction } from '../../domain/__tests__/transaction.factory';
import { TransactionStatus } from '../../domain/enums/transaction-status.enum';
import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { type TransactionRepository } from '../../domain/transaction.repository';

import { SettleTransactionUseCase } from './settle-transaction.use-case';

import type { SettleTransactionDto } from '../dto/settle-transaction.dto';

describe('SettleTransactionUseCase', () => {
  let useCase: SettleTransactionUseCase;
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

    useCase = new SettleTransactionUseCase(txRepo, accountRepo);
  });

  const settleDto: SettleTransactionDto = {
    accountId: 'acc-1',
    amount: 60,
  };

  it('should settle DEBT partially creating an EXPENSE', async () => {
    const debt = buildTransaction({
      id: 'debt-1',
      userId,
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 100,
      status: TransactionStatus.PENDING,
      reference: 'Juan',
      description: 'Deuda almuerzo',
    });
    const account = buildAccount({ id: 'acc-1', userId, balance: 500 });

    txRepo.findById.mockResolvedValue(debt);
    accountRepo.findById.mockResolvedValue(account);

    const result = await useCase.execute('debt-1', userId, settleDto);

    expect(result.type).toBe(TransactionType.EXPENSE);
    expect(result.amount).toBe(60);
    expect(result.relatedTransactionId).toBe('debt-1');
    expect(result.reference).toBe('Juan');
    expect(account.balance).toBe(440); // 500 - 60
    expect(debt.remainingAmount).toBe(40);
    expect(debt.status).toBe(TransactionStatus.PENDING);
  });

  it('should settle DEBT fully and mark as SETTLED', async () => {
    const debt = buildTransaction({
      id: 'debt-1',
      userId,
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 60,
      status: TransactionStatus.PENDING,
      reference: 'Juan',
    });
    const account = buildAccount({ id: 'acc-1', userId, balance: 500 });

    txRepo.findById.mockResolvedValue(debt);
    accountRepo.findById.mockResolvedValue(account);

    await useCase.execute('debt-1', userId, settleDto);

    expect(debt.remainingAmount).toBe(0);
    expect(debt.status).toBe(TransactionStatus.SETTLED);
  });

  it('should settle LOAN creating an INCOME', async () => {
    const loan = buildTransaction({
      id: 'loan-1',
      userId,
      type: TransactionType.LOAN,
      amount: 200,
      remainingAmount: 200,
      status: TransactionStatus.PENDING,
      reference: 'María',
      description: 'Préstamo dinero',
    });
    const account = buildAccount({ id: 'acc-1', userId, balance: 100 });

    txRepo.findById.mockResolvedValue(loan);
    accountRepo.findById.mockResolvedValue(account);

    const result = await useCase.execute('loan-1', userId, settleDto);

    expect(result.type).toBe(TransactionType.INCOME);
    expect(account.balance).toBe(160); // 100 + 60
    expect(loan.remainingAmount).toBe(140);
  });

  it('should use custom description when provided', async () => {
    const debt = buildTransaction({
      id: 'debt-1',
      userId,
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 100,
      status: TransactionStatus.PENDING,
      reference: 'Juan',
    });
    const account = buildAccount({ id: 'acc-1', userId, balance: 500 });

    txRepo.findById.mockResolvedValue(debt);
    accountRepo.findById.mockResolvedValue(account);

    const result = await useCase.execute('debt-1', userId, {
      ...settleDto,
      description: 'Pago parcial marzo',
    });

    expect(result.description).toBe('Pago parcial marzo');
  });

  it('should throw TRANSACTION_NOT_FOUND if not found', async () => {
    txRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId, settleDto)).rejects.toThrow(
      'Transacción no encontrada',
    );
  });

  it('should throw TRANSACTION_BELONGS_TO_OTHER_USER if not owned', async () => {
    const debt = buildTransaction({ userId: 'other-user', type: TransactionType.DEBT });
    txRepo.findById.mockResolvedValue(debt);

    await expect(useCase.execute(debt.id, userId, settleDto)).rejects.toThrow(DomainException);
  });

  it('should throw TRANSACTION_NOT_DEBT_OR_LOAN for non DEBT/LOAN', async () => {
    const expense = buildTransaction({ userId, type: TransactionType.EXPENSE });
    txRepo.findById.mockResolvedValue(expense);

    await expect(useCase.execute(expense.id, userId, settleDto)).rejects.toThrow(
      'Solo se pueden liquidar transacciones de tipo DEBT o LOAN',
    );
  });

  it('should throw TRANSACTION_ALREADY_SETTLED if fully settled', async () => {
    const debt = buildTransaction({
      userId,
      type: TransactionType.DEBT,
      status: TransactionStatus.SETTLED,
      remainingAmount: 0,
    });
    txRepo.findById.mockResolvedValue(debt);

    await expect(useCase.execute(debt.id, userId, settleDto)).rejects.toThrow(
      'La deuda/préstamo ya fue liquidada completamente',
    );
  });

  it('should throw SETTLEMENT_AMOUNT_EXCEEDS_REMAINING if amount > remaining', async () => {
    const debt = buildTransaction({
      userId,
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 30,
      status: TransactionStatus.PENDING,
    });
    txRepo.findById.mockResolvedValue(debt);

    await expect(useCase.execute(debt.id, userId, settleDto)).rejects.toThrow(
      'El monto excede el saldo pendiente',
    );
  });

  it('should throw ACCOUNT_NOT_FOUND if settlement account does not exist', async () => {
    const debt = buildTransaction({
      userId,
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 100,
      status: TransactionStatus.PENDING,
    });
    txRepo.findById.mockResolvedValue(debt);
    accountRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(debt.id, userId, settleDto)).rejects.toThrow(
      'Cuenta no encontrada',
    );
  });

  it('should throw ACCOUNT_BELONGS_TO_OTHER_USER if account not owned', async () => {
    const debt = buildTransaction({
      userId,
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 100,
      status: TransactionStatus.PENDING,
    });
    const account = buildAccount({ id: 'acc-1', userId: 'other-user' });

    txRepo.findById.mockResolvedValue(debt);
    accountRepo.findById.mockResolvedValue(account);

    await expect(useCase.execute(debt.id, userId, settleDto)).rejects.toThrow(DomainException);
  });
});
