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
  /** Substring match (case + accent insensitive) across description and reference. */
  search?: string;
}

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
}

export type DebtsSummaryStatusFilter = 'pending' | 'all' | 'settled';

export interface DebtsSummaryRow {
  /** Normalized reference — lowercase and accent-stripped. Part of grouping key. */
  reference: string;
  /**
   * Currency code (PEN, USD, EUR, ...) of the account that holds these tx.
   * Part of the grouping key — a person with debts in different currencies
   * collapses into one row per currency, never mixed.
   */
  currency: string;
  /** Display name — the most recently written spelling of this reference. */
  displayName: string;
  /** Sum of remaining amounts for pending DEBT tx (what the user owes). */
  pendingDebt: number;
  /** Sum of remaining amounts for pending LOAN tx (what is owed to the user). */
  pendingLoan: number;
  /** `pendingLoan - pendingDebt`. Positive = owed to user, negative = user owes. */
  netOwed: number;
  /** Number of pending DEBT/LOAN tx (includes partially settled). */
  pendingCount: number;
  /** Number of fully settled DEBT/LOAN tx. */
  settledCount: number;
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
  /**
   * Aggregate DEBT/LOAN transactions grouped by normalized reference.
   *
   * Normalization uses Postgres `unaccent` + `LOWER` so "Juán", "Juan", "JUAN"
   * collapse into a single row. `displayName` carries the most recent casing.
   */
  abstract aggregateDebtsByReference(
    userId: string,
    statusFilter: DebtsSummaryStatusFilter,
  ): Promise<DebtsSummaryRow[]>;
  /**
   * Fetch all pending DEBT/LOAN transactions whose reference matches the given
   * value after normalization (LOWER + unaccent). Used by the bulk-settle flow
   * so a single `reference` input (e.g. "Juan") collects every pending row for
   * that person across casings ("juan", "Juán", "JUAN").
   *
   * If `currency` is provided, the result is further filtered to transactions
   * whose account has that currency. Bulk settle always settles one currency
   * bucket at a time so partial closeouts stay meaningful.
   */
  abstract findPendingDebtOrLoanByNormalizedReference(
    userId: string,
    reference: string,
    currency?: string,
  ): Promise<Transaction[]>;
}
