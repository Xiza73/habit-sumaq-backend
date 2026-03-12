import { buildTransaction } from './__tests__/transaction.factory';
import { TransactionType } from './enums/transaction-type.enum';

describe('Transaction entity', () => {
  it('should report isTransfer() correctly', () => {
    const transfer = buildTransaction({
      type: TransactionType.TRANSFER,
      destinationAccountId: 'acc-2',
    });
    const expense = buildTransaction({
      type: TransactionType.EXPENSE,
      destinationAccountId: null,
    });

    expect(transfer.isTransfer()).toBe(true);
    expect(expense.isTransfer()).toBe(false);
  });

  it('should report isDeleted() correctly', () => {
    const active = buildTransaction({ deletedAt: null });
    const deleted = buildTransaction({ deletedAt: new Date() });

    expect(active.isDeleted()).toBe(false);
    expect(deleted.isDeleted()).toBe(true);
  });
});
