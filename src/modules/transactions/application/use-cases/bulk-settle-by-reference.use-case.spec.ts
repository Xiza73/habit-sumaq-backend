import { buildTransaction } from '../../domain/__tests__/transaction.factory';
import { TransactionStatus } from '../../domain/enums/transaction-status.enum';
import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { type TransactionRepository } from '../../domain/transaction.repository';

import { BulkSettleByReferenceUseCase } from './bulk-settle-by-reference.use-case';

describe('BulkSettleByReferenceUseCase', () => {
  let useCase: BulkSettleByReferenceUseCase;
  let mockRepo: jest.Mocked<TransactionRepository>;
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
    } as jest.Mocked<TransactionRepository>;

    useCase = new BulkSettleByReferenceUseCase(mockRepo);
  });

  it('returns count=0 and skips save when no pending tx match the reference', async () => {
    mockRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([]);

    const result = await useCase.execute(userId, 'Unknown');

    expect(result).toEqual({ settledIds: [], totalSettled: 0, count: 0 });
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
});
