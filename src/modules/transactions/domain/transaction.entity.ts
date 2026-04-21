import { TransactionStatus } from './enums/transaction-status.enum';
import { TransactionType } from './enums/transaction-type.enum';

export class Transaction {
  constructor(
    readonly id: string,
    readonly userId: string,
    public accountId: string,
    public categoryId: string | null,
    public type: TransactionType,
    public amount: number,
    public description: string | null,
    public date: Date,
    public destinationAccountId: string | null,
    public reference: string | null,
    public status: TransactionStatus | null,
    public relatedTransactionId: string | null,
    public remainingAmount: number | null,
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
    public monthlyServiceId: string | null = null,
  ) {}

  isTransfer(): boolean {
    return this.destinationAccountId !== null;
  }

  isDebtOrLoan(): boolean {
    return this.type === TransactionType.DEBT || this.type === TransactionType.LOAN;
  }

  isPending(): boolean {
    return this.status === TransactionStatus.PENDING;
  }

  isSettled(): boolean {
    return this.status === TransactionStatus.SETTLED;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  applySettlement(settledAmount: number): void {
    this.remainingAmount = (this.remainingAmount ?? 0) - settledAmount;
    if (this.remainingAmount <= 0) {
      this.remainingAmount = 0;
      this.status = TransactionStatus.SETTLED;
    }
    this.updatedAt = new Date();
  }

  revertSettlement(settledAmount: number): void {
    this.remainingAmount = (this.remainingAmount ?? 0) + settledAmount;
    this.status = TransactionStatus.PENDING;
    this.updatedAt = new Date();
  }
}
