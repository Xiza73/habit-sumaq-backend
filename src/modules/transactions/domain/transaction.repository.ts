import type { TransactionStatus } from './enums/transaction-status.enum';
import type { TransactionType } from './enums/transaction-type.enum';
import type { Transaction } from './transaction.entity';

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export abstract class TransactionRepository {
  abstract findByUserId(userId: string, filters?: TransactionFilters): Promise<Transaction[]>;
  abstract findById(id: string): Promise<Transaction | null>;
  abstract findByRelatedTransactionId(relatedTransactionId: string): Promise<Transaction[]>;
  abstract save(transaction: Transaction): Promise<Transaction>;
  abstract softDelete(id: string): Promise<void>;
  abstract existsByAccountId(accountId: string): Promise<boolean>;
}
