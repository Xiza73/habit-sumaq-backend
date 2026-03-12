import { buildTransaction } from '../../domain/__tests__/transaction.factory';
import { TransactionType } from '../../domain/enums/transaction-type.enum';

import { TransactionResponseDto } from './transaction-response.dto';

describe('TransactionResponseDto.fromDomain', () => {
  it('should map all domain fields correctly', () => {
    const tx = buildTransaction({
      type: TransactionType.EXPENSE,
      amount: 42.5,
      description: 'Test',
      destinationAccountId: null,
    });

    const dto = TransactionResponseDto.fromDomain(tx);

    expect(dto.id).toBe(tx.id);
    expect(dto.userId).toBe(tx.userId);
    expect(dto.accountId).toBe(tx.accountId);
    expect(dto.categoryId).toBe(tx.categoryId);
    expect(dto.type).toBe(TransactionType.EXPENSE);
    expect(dto.amount).toBe(42.5);
    expect(dto.description).toBe('Test');
    expect(dto.date).toBe(tx.date);
    expect(dto.destinationAccountId).toBeNull();
    expect(dto.createdAt).toBe(tx.createdAt);
    expect(dto.updatedAt).toBe(tx.updatedAt);
  });

  it('should not expose deletedAt', () => {
    const tx = buildTransaction();
    const dto = TransactionResponseDto.fromDomain(tx);
    expect(dto).not.toHaveProperty('deletedAt');
  });
});
