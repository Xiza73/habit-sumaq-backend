import { DomainException } from '@common/exceptions/domain.exception';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';
import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { TransactionStatus } from '../../domain/enums/transaction-status.enum';
import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { type TransactionRepository } from '../../domain/transaction.repository';

import { CreateTransactionUseCase } from './create-transaction.use-case';

import type { CreateTransactionDto } from '../dto/create-transaction.dto';

describe('CreateTransactionUseCase', () => {
  let useCase: CreateTransactionUseCase;
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
      aggregateDebtsByReference: jest.fn(),
      findPendingDebtOrLoanByNormalizedReference: jest.fn(),
    } as jest.Mocked<TransactionRepository>;

    accountRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
      softDelete: jest.fn(),
    } as jest.Mocked<AccountRepository>;

    useCase = new CreateTransactionUseCase(txRepo, accountRepo);
  });

  const expenseDto: CreateTransactionDto = {
    accountId: 'acc-1',
    categoryId: 'cat-1',
    type: TransactionType.EXPENSE,
    amount: 50,
    description: 'Almuerzo',
    date: new Date('2026-01-15'),
  };

  it('should create an expense and debit the account', async () => {
    const account = buildAccount({ id: 'acc-1', userId, balance: 200 });
    accountRepo.findById.mockResolvedValue(account);

    const result = await useCase.execute(userId, expenseDto);

    expect(result.type).toBe(TransactionType.EXPENSE);
    expect(result.amount).toBe(50);
    expect(account.balance).toBe(150);
    expect(accountRepo.save).toHaveBeenCalledWith(account);
    expect(txRepo.save).toHaveBeenCalled();
  });

  it('should create an income and credit the account', async () => {
    const account = buildAccount({ id: 'acc-1', userId, balance: 100 });
    accountRepo.findById.mockResolvedValue(account);

    const dto: CreateTransactionDto = { ...expenseDto, type: TransactionType.INCOME };
    const result = await useCase.execute(userId, dto);

    expect(result.type).toBe(TransactionType.INCOME);
    expect(account.balance).toBe(150);
  });

  it('should create a transfer debiting source and crediting destination', async () => {
    const source = buildAccount({ id: 'acc-1', userId, balance: 500, currency: Currency.PEN });
    const dest = buildAccount({ id: 'acc-2', userId, balance: 100, currency: Currency.PEN });
    accountRepo.findById.mockImplementation((id) => {
      if (id === 'acc-1') return Promise.resolve(source);
      if (id === 'acc-2') return Promise.resolve(dest);
      return Promise.resolve(null);
    });

    const dto: CreateTransactionDto = {
      ...expenseDto,
      type: TransactionType.TRANSFER,
      destinationAccountId: 'acc-2',
    };
    await useCase.execute(userId, dto);

    expect(source.balance).toBe(450);
    expect(dest.balance).toBe(150);
    expect(accountRepo.save).toHaveBeenCalledTimes(2);
  });

  it('should throw ACCOUNT_NOT_FOUND if source account does not exist', async () => {
    accountRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(userId, expenseDto)).rejects.toThrow(DomainException);
    await expect(useCase.execute(userId, expenseDto)).rejects.toThrow(
      'Cuenta origen no encontrada',
    );
  });

  it('should throw ACCOUNT_BELONGS_TO_OTHER_USER if source is not owned', async () => {
    const account = buildAccount({ id: 'acc-1', userId: 'other-user' });
    accountRepo.findById.mockResolvedValue(account);

    await expect(useCase.execute(userId, expenseDto)).rejects.toThrow(DomainException);
  });

  it('should throw TRANSFER_DESTINATION_REQUIRED for transfer without destination', async () => {
    const account = buildAccount({ id: 'acc-1', userId });
    accountRepo.findById.mockResolvedValue(account);

    const dto: CreateTransactionDto = {
      ...expenseDto,
      type: TransactionType.TRANSFER,
      destinationAccountId: undefined,
    };

    await expect(useCase.execute(userId, dto)).rejects.toThrow(
      'Las transferencias requieren una cuenta destino',
    );
  });

  it('should throw TRANSFER_SAME_ACCOUNT when source equals destination', async () => {
    const account = buildAccount({ id: 'acc-1', userId });
    accountRepo.findById.mockResolvedValue(account);

    const dto: CreateTransactionDto = {
      ...expenseDto,
      type: TransactionType.TRANSFER,
      destinationAccountId: 'acc-1',
    };

    await expect(useCase.execute(userId, dto)).rejects.toThrow(
      'No puedes transferir a la misma cuenta',
    );
  });

  it('should throw DESTINATION_ACCOUNT_NOT_FOUND if destination does not exist', async () => {
    const source = buildAccount({ id: 'acc-1', userId });
    accountRepo.findById.mockImplementation((id) =>
      Promise.resolve(id === 'acc-1' ? source : null),
    );

    const dto: CreateTransactionDto = {
      ...expenseDto,
      type: TransactionType.TRANSFER,
      destinationAccountId: 'acc-nonexistent',
    };

    await expect(useCase.execute(userId, dto)).rejects.toThrow('Cuenta destino no encontrada');
  });

  it('should throw TRANSFER_CURRENCY_MISMATCH when currencies differ', async () => {
    const source = buildAccount({ id: 'acc-1', userId, currency: Currency.PEN });
    const dest = buildAccount({ id: 'acc-2', userId, currency: Currency.USD });
    accountRepo.findById.mockImplementation((id) => {
      if (id === 'acc-1') return Promise.resolve(source);
      if (id === 'acc-2') return Promise.resolve(dest);
      return Promise.resolve(null);
    });

    const dto: CreateTransactionDto = {
      ...expenseDto,
      type: TransactionType.TRANSFER,
      destinationAccountId: 'acc-2',
    };

    await expect(useCase.execute(userId, dto)).rejects.toThrow(
      'Las cuentas deben tener la misma moneda para transferir',
    );
  });

  it('should create a DEBT without affecting balance', async () => {
    const account = buildAccount({ id: 'acc-1', userId, balance: 500 });
    accountRepo.findById.mockResolvedValue(account);

    const dto: CreateTransactionDto = {
      ...expenseDto,
      type: TransactionType.DEBT,
      reference: 'Juan Pérez',
    };
    const result = await useCase.execute(userId, dto);

    expect(result.type).toBe(TransactionType.DEBT);
    expect(result.status).toBe(TransactionStatus.PENDING);
    expect(result.remainingAmount).toBe(50);
    expect(result.reference).toBe('Juan Pérez');
    expect(account.balance).toBe(500); // unchanged
    expect(accountRepo.save).not.toHaveBeenCalled();
  });

  it('should create a LOAN without affecting balance', async () => {
    const account = buildAccount({ id: 'acc-1', userId, balance: 300 });
    accountRepo.findById.mockResolvedValue(account);

    const dto: CreateTransactionDto = {
      ...expenseDto,
      type: TransactionType.LOAN,
      reference: 'Empresa X',
    };
    const result = await useCase.execute(userId, dto);

    expect(result.type).toBe(TransactionType.LOAN);
    expect(result.status).toBe(TransactionStatus.PENDING);
    expect(result.remainingAmount).toBe(50);
    expect(account.balance).toBe(300); // unchanged
  });

  it('should throw REFERENCE_REQUIRED for DEBT without reference', async () => {
    const account = buildAccount({ id: 'acc-1', userId });
    accountRepo.findById.mockResolvedValue(account);

    const dto: CreateTransactionDto = {
      ...expenseDto,
      type: TransactionType.DEBT,
    };

    await expect(useCase.execute(userId, dto)).rejects.toThrow(
      'Las deudas y préstamos requieren un campo reference',
    );
  });
});
