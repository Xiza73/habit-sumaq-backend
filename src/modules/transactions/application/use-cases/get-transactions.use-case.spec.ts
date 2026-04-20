import { buildTransaction } from '../../domain/__tests__/transaction.factory';
import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { type TransactionRepository } from '../../domain/transaction.repository';

import { GetTransactionsUseCase } from './get-transactions.use-case';

describe('GetTransactionsUseCase', () => {
  let useCase: GetTransactionsUseCase;
  let txRepo: jest.Mocked<TransactionRepository>;

  beforeEach(() => {
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
    } as jest.Mocked<TransactionRepository>;

    useCase = new GetTransactionsUseCase(txRepo);
  });

  it('should return paginated transactions for a user', async () => {
    const txs = [buildTransaction(), buildTransaction()];
    txRepo.findByUserId.mockResolvedValue({ items: txs, total: 2 });

    const result = await useCase.execute('user-1', { page: 1, limit: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
    expect(txRepo.findByUserId).toHaveBeenCalledWith(
      'user-1',
      {
        accountId: undefined,
        categoryId: undefined,
        type: undefined,
        status: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        search: undefined,
      },
      { page: 1, limit: 20 },
    );
  });

  it('should pass filters and pagination to the repository', async () => {
    txRepo.findByUserId.mockResolvedValue({ items: [], total: 0 });

    const result = await useCase.execute('user-1', {
      accountId: 'acc-1',
      type: TransactionType.EXPENSE,
      page: 2,
      limit: 10,
    });

    expect(result.items).toHaveLength(0);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 0, totalPages: 0 });
    expect(txRepo.findByUserId).toHaveBeenCalledWith(
      'user-1',
      {
        accountId: 'acc-1',
        categoryId: undefined,
        type: TransactionType.EXPENSE,
        status: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        search: undefined,
      },
      { page: 2, limit: 10 },
    );
  });

  it('should forward the search query to the repository', async () => {
    txRepo.findByUserId.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute('user-1', { page: 1, limit: 20, search: 'Juán' });

    expect(txRepo.findByUserId).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ search: 'Juán' }),
      { page: 1, limit: 20 },
    );
  });

  it('should calculate totalPages correctly', async () => {
    txRepo.findByUserId.mockResolvedValue({ items: [buildTransaction()], total: 45 });

    const result = await useCase.execute('user-1', { page: 1, limit: 20 });

    expect(result.meta.totalPages).toBe(3);
  });
});
