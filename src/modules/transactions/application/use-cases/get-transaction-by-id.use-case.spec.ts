import { DomainException } from '@common/exceptions/domain.exception';

import { buildTransaction } from '../../domain/__tests__/transaction.factory';
import { type TransactionRepository } from '../../domain/transaction.repository';

import { GetTransactionByIdUseCase } from './get-transaction-by-id.use-case';

describe('GetTransactionByIdUseCase', () => {
  let useCase: GetTransactionByIdUseCase;
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
    } as jest.Mocked<TransactionRepository>;

    useCase = new GetTransactionByIdUseCase(txRepo);
  });

  it('should return the transaction when found and owned by user', async () => {
    const tx = buildTransaction({ userId: 'user-1' });
    txRepo.findById.mockResolvedValue(tx);

    const result = await useCase.execute(tx.id, 'user-1');
    expect(result.id).toBe(tx.id);
  });

  it('should throw TRANSACTION_NOT_FOUND when not found', async () => {
    txRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('nonexistent', 'user-1')).rejects.toThrow(DomainException);
    await expect(useCase.execute('nonexistent', 'user-1')).rejects.toThrow(
      'Transacción no encontrada',
    );
  });

  it('should throw TRANSACTION_BELONGS_TO_OTHER_USER when not owned', async () => {
    const tx = buildTransaction({ userId: 'other-user' });
    txRepo.findById.mockResolvedValue(tx);

    await expect(useCase.execute(tx.id, 'user-1')).rejects.toThrow(DomainException);
  });
});
