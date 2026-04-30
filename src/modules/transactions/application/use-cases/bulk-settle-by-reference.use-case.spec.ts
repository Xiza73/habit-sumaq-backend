import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { DomainException } from '@common/exceptions/domain.exception';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';
import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { buildTransaction } from '../../domain/__tests__/transaction.factory';
import { TransactionStatus } from '../../domain/enums/transaction-status.enum';
import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { type TransactionRepository } from '../../domain/transaction.repository';

import { BulkSettleByReferenceUseCase } from './bulk-settle-by-reference.use-case';

describe('BulkSettleByReferenceUseCase', () => {
  let useCase: BulkSettleByReferenceUseCase;
  let mockRepo: jest.Mocked<TransactionRepository>;
  let mockAccountRepo: jest.Mocked<AccountRepository>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;
  const userId = 'user-1';

  beforeEach(() => {
    mockRepo = {
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

    mockAccountRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
      softDelete: jest.fn(),
    };

    mockLogger = buildMockPinoLogger();
    useCase = new BulkSettleByReferenceUseCase(
      mockRepo,
      mockAccountRepo,
      mockLogger as unknown as PinoLogger,
    );
  });

  it('returns count=0 and skips save when no pending tx match the reference', async () => {
    mockRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([]);

    const result = await useCase.execute(userId, 'Unknown');

    expect(result).toEqual({ settledIds: [], totalSettled: 0, count: 0, settlementIds: [] });
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('settles each pending tx and accumulates totalSettled', async () => {
    const tx1 = buildTransaction({
      id: 'tx-1',
      type: TransactionType.DEBT,
      amount: 500,
      remainingAmount: 500,
      status: TransactionStatus.PENDING,
      reference: 'Juan',
    });
    const tx2 = buildTransaction({
      id: 'tx-2',
      type: TransactionType.LOAN,
      amount: 300,
      remainingAmount: 200, // partially settled
      status: TransactionStatus.PENDING,
      reference: 'Juan',
    });
    mockRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([tx1, tx2]);

    const result = await useCase.execute(userId, 'Juan');

    expect(result.count).toBe(2);
    expect(result.totalSettled).toBe(700); // 500 + 200
    expect(result.settledIds).toEqual(['tx-1', 'tx-2']);
    expect(tx1.status).toBe(TransactionStatus.SETTLED);
    expect(tx1.remainingAmount).toBe(0);
    expect(tx2.status).toBe(TransactionStatus.SETTLED);
    expect(tx2.remainingAmount).toBe(0);
    expect(mockRepo.save).toHaveBeenCalledTimes(2);
  });

  it('forwards the raw reference to the repository (repo handles normalization)', async () => {
    mockRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([]);

    await useCase.execute(userId, 'Juán');

    expect(mockRepo.findPendingDebtOrLoanByNormalizedReference).toHaveBeenCalledWith(
      userId,
      'Juán',
      undefined,
    );
  });

  it('passes the currency filter to the repository when provided', async () => {
    mockRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([]);

    await useCase.execute(userId, 'Juan', 'USD');

    expect(mockRepo.findPendingDebtOrLoanByNormalizedReference).toHaveBeenCalledWith(
      userId,
      'Juan',
      'USD',
    );
  });

  describe('real payment mode (with accountId)', () => {
    it('creates one settlement per pending tx, debits/credits the account, and reports settlementIds', async () => {
      const debt = buildTransaction({
        id: 'tx-debt',
        type: TransactionType.DEBT,
        amount: 500,
        remainingAmount: 500,
        status: TransactionStatus.PENDING,
        reference: 'Juan',
      });
      const loan = buildTransaction({
        id: 'tx-loan',
        type: TransactionType.LOAN,
        amount: 300,
        remainingAmount: 200,
        status: TransactionStatus.PENDING,
        reference: 'Juan',
      });
      mockRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([debt, loan]);
      const account = buildAccount({
        id: 'acc-1',
        userId,
        currency: Currency.PEN,
        balance: 1000,
      });
      mockAccountRepo.findById.mockResolvedValue(account);

      const result = await useCase.execute(userId, 'Juan', 'PEN', 'acc-1');

      expect(result.count).toBe(2);
      expect(result.totalSettled).toBe(700);
      expect(result.settledIds).toEqual(['tx-debt', 'tx-loan']);
      expect(result.settlementIds).toHaveLength(2);
      // DEBT -500 (debit) + LOAN +200 (credit) = -300 net.
      expect(account.balance).toBe(700);
      // Two settlement saves + two original updates = 4 saves on the tx repo.
      expect(mockRepo.save).toHaveBeenCalledTimes(4);
      expect(mockAccountRepo.save).toHaveBeenCalledWith(account);
    });

    it('throws ACCOUNT_NOT_FOUND when the payment account does not exist', async () => {
      mockRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([
        buildTransaction({ remainingAmount: 100, status: TransactionStatus.PENDING }),
      ]);
      mockAccountRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute(userId, 'Juan', 'PEN', 'missing')).rejects.toThrow(
        DomainException,
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws when the payment account belongs to another user', async () => {
      mockRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([
        buildTransaction({ remainingAmount: 100, status: TransactionStatus.PENDING }),
      ]);
      mockAccountRepo.findById.mockResolvedValue(
        buildAccount({ id: 'acc-1', userId: 'other-user', currency: Currency.PEN }),
      );

      await expect(useCase.execute(userId, 'Juan', 'PEN', 'acc-1')).rejects.toThrow(
        'No tienes acceso a esta cuenta',
      );
    });

    it('throws CURRENCY_MISMATCH when the account currency differs from the filter', async () => {
      mockRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([
        buildTransaction({ remainingAmount: 100, status: TransactionStatus.PENDING }),
      ]);
      mockAccountRepo.findById.mockResolvedValue(
        buildAccount({ id: 'acc-1', userId, currency: Currency.USD }),
      );

      await expect(useCase.execute(userId, 'Juan', 'PEN', 'acc-1')).rejects.toThrow(
        'La cuenta de pago debe tener la misma moneda que las deudas/préstamos a liquidar',
      );
    });
  });
});
