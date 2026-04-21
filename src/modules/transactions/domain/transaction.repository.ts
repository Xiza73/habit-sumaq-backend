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

/** Aggregate row returned by {@link TransactionRepository.sumFlowByCurrencyInRange}. */
export interface FlowByCurrencyRow {
  currency: string;
  income: number;
  expense: number;
}

/** Aggregate row returned by {@link TransactionRepository.topExpenseCategoriesInRange}. */
export interface TopCategoryRow {
  categoryId: string | null;
  name: string | null;
  color: string | null;
  currency: string;
  total: number;
}

/** Aggregate row returned by {@link TransactionRepository.dailyNetFlowInRange}. */
export interface DailyNetFlowRow {
  /** `YYYY-MM-DD` in UTC — frontend renders per-currency lines. */
  date: string;
  currency: string;
  income: number;
  expense: number;
}

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
   * Counts non-deleted transactions linked to a monthly service. Used by
   * the hard-delete guard on `DELETE /monthly-services/:id` — services that
   * already produced payments cannot be hard-deleted, only archived.
   */
  abstract countByMonthlyServiceId(monthlyServiceId: string): Promise<number>;
  /**
   * Returns up to `limit` most recent non-deleted transactions linked to a
   * monthly service, ordered by date DESC. Used when paying a service to
   * recompute `estimatedAmount` from the moving average of recent payments.
   */
  abstract findLastNByMonthlyServiceId(
    monthlyServiceId: string,
    limit: number,
  ): Promise<Transaction[]>;
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

  /**
   * Sum INCOME and EXPENSE amounts in a given date range, grouped by the
   * currency of the source account. Excludes DEBT/LOAN and their settlements
   * (those are accounted for via {@link aggregateDebtsByReference}).
   */
  abstract sumFlowByCurrencyInRange(
    userId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<FlowByCurrencyRow[]>;

  /**
   * Top N EXPENSE categories by total amount in the given date range, grouped
   * by category + currency. Uncategorized rows (categoryId null) collapse into
   * a single row with name=null. Ordered by total DESC.
   */
  abstract topExpenseCategoriesInRange(
    userId: string,
    dateFrom: Date,
    dateTo: Date,
    limit: number,
  ): Promise<TopCategoryRow[]>;

  /**
   * Per-day INCOME + EXPENSE totals in the range, grouped by date (UTC) and
   * currency. Used to render a "daily flow" chart on the finances dashboard.
   */
  abstract dailyNetFlowInRange(
    userId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<DailyNetFlowRow[]>;
}
