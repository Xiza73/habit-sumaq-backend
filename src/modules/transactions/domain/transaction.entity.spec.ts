import { buildTransaction } from './__tests__/transaction.factory';
import { TransactionStatus } from './enums/transaction-status.enum';
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

  it('should report isDebtOrLoan() correctly', () => {
    const debt = buildTransaction({ type: TransactionType.DEBT });
    const loan = buildTransaction({ type: TransactionType.LOAN });
    const expense = buildTransaction({ type: TransactionType.EXPENSE });

    expect(debt.isDebtOrLoan()).toBe(true);
    expect(loan.isDebtOrLoan()).toBe(true);
    expect(expense.isDebtOrLoan()).toBe(false);
  });

  it('should report isPending() and isSettled() correctly', () => {
    const pending = buildTransaction({ status: TransactionStatus.PENDING });
    const settled = buildTransaction({ status: TransactionStatus.SETTLED });
    const none = buildTransaction({ status: null });

    expect(pending.isPending()).toBe(true);
    expect(pending.isSettled()).toBe(false);
    expect(settled.isSettled()).toBe(true);
    expect(settled.isPending()).toBe(false);
    expect(none.isPending()).toBe(false);
    expect(none.isSettled()).toBe(false);
  });

  it('should apply partial settlement correctly', () => {
    const tx = buildTransaction({
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 100,
      status: TransactionStatus.PENDING,
    });

    tx.applySettlement(60);

    expect(tx.remainingAmount).toBe(40);
    expect(tx.status).toBe(TransactionStatus.PENDING);
  });

  it('should settle fully when remainingAmount reaches 0', () => {
    const tx = buildTransaction({
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 50,
      status: TransactionStatus.PENDING,
    });

    tx.applySettlement(50);

    expect(tx.remainingAmount).toBe(0);
    expect(tx.status).toBe(TransactionStatus.SETTLED);
  });

  it('should revert settlement correctly', () => {
    const tx = buildTransaction({
      type: TransactionType.DEBT,
      amount: 100,
      remainingAmount: 0,
      status: TransactionStatus.SETTLED,
    });

    tx.revertSettlement(60);

    expect(tx.remainingAmount).toBe(60);
    expect(tx.status).toBe(TransactionStatus.PENDING);
  });
});
