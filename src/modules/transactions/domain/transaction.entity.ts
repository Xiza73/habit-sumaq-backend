import { type TransactionType } from './enums/transaction-type.enum';

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
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  isTransfer(): boolean {
    return this.destinationAccountId !== null;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
