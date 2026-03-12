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
      save: jest.fn(),
      softDelete: jest.fn(),
      existsByAccountId: jest.fn(),
    } as jest.Mocked<TransactionRepository>;

    useCase = new GetTransactionsUseCase(txRepo);
  });

  it('should return all transactions for a user', async () => {
    const txs = [buildTransaction(), buildTransaction()];
    txRepo.findByUserId.mockResolvedValue(txs);

    const result = await useCase.execute('user-1', {});

    expect(result).toHaveLength(2);
    expect(txRepo.findByUserId).toHaveBeenCalledWith('user-1', {
      accountId: undefined,
      categoryId: undefined,
      type: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  });

  it('should pass filters to the repository', async () => {
    txRepo.findByUserId.mockResolvedValue([]);

    await useCase.execute('user-1', {
      accountId: 'acc-1',
      type: TransactionType.EXPENSE,
    });

    expect(txRepo.findByUserId).toHaveBeenCalledWith('user-1', {
      accountId: 'acc-1',
      categoryId: undefined,
      type: TransactionType.EXPENSE,
      dateFrom: undefined,
      dateTo: undefined,
    });
  });
});
