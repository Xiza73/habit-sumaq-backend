import {
  type DebtsSummaryRow,
  type TransactionRepository,
} from '../../domain/transaction.repository';

import { GetDebtsSummaryUseCase } from './get-debts-summary.use-case';

describe('GetDebtsSummaryUseCase', () => {
  let useCase: GetDebtsSummaryUseCase;
  let mockRepo: jest.Mocked<TransactionRepository>;
  const userId = 'user-1';

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByRelatedTransactionId: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      existsByAccountId: jest.fn(),
      aggregateDebtsByReference: jest.fn(),
      findPendingDebtOrLoanByNormalizedReference: jest.fn(),
    } as unknown as jest.Mocked<TransactionRepository>;

    useCase = new GetDebtsSummaryUseCase(mockRepo);
  });

  it('returns an empty array when the user has no DEBT/LOAN transactions', async () => {
    mockRepo.aggregateDebtsByReference.mockResolvedValue([]);

    const result = await useCase.execute(userId, 'pending');

    expect(result).toEqual([]);
    expect(mockRepo.aggregateDebtsByReference).toHaveBeenCalledWith(userId, 'pending');
  });

  it('returns the rows from the repository unchanged', async () => {
    const row: DebtsSummaryRow = {
      reference: 'juan',
      currency: 'PEN',
      displayName: 'Juan',
      pendingDebt: 500,
      pendingLoan: 300,
      netOwed: -200,
      pendingCount: 3,
      settledCount: 1,
    };
    mockRepo.aggregateDebtsByReference.mockResolvedValue([row]);

    const result = await useCase.execute(userId, 'pending');

    expect(result).toEqual([row]);
  });

  it('forwards the status filter to the repository', async () => {
    mockRepo.aggregateDebtsByReference.mockResolvedValue([]);

    await useCase.execute(userId, 'all');
    expect(mockRepo.aggregateDebtsByReference).toHaveBeenCalledWith(userId, 'all');

    await useCase.execute(userId, 'settled');
    expect(mockRepo.aggregateDebtsByReference).toHaveBeenCalledWith(userId, 'settled');
  });
});
