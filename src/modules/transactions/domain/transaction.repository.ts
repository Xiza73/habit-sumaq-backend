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

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
}

export abstract class TransactionRepository {
  abstract findByUserId(
    userId: string,
    filters?: TransactionFilters,
    pagination?: { page: number; limit: number },
  ): Promise<PaginatedTransactions>;
  abstract findById(id: string): Promise<Transaction | null>;
  abstract findByRelatedTransactionId(relatedTransactionId: string): Promise<Transaction[]>;
  abstract save(transaction: Transaction): Promise<Transaction>;
  abstract softDelete(id: string): Promise<void>;
  abstract existsByAccountId(accountId: string): Promise<boolean>;
}
