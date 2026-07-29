import { type EntityManager } from 'typeorm';

import { type Currency } from '@common/enums/currency.enum';

import { type DebtLoan } from './debt-loan.entity';

/**
 * Status filter for list / summary endpoints.
 *
 *  - `pending`: rows with `status = PENDING` (default for the UI's main view).
 *  - `settled`: rows where all of a `(reference, currency)` group is closed.
 *  - `all`: no filter.
 */
export type DebtLoanStatusFilter = 'pending' | 'settled' | 'all';

/**
 * Aggregated row from the by-reference summary query. One row per
 * `(normalized reference, currency)` pair — same shape that the legacy
 * `/transactions/debts-summary` endpoint used, so the frontend Debts &
 * Loans dashboard can swap source without changing its render code.
 */
export interface DebtsSummaryRow {
  reference: string;
  currency: Currency;
  displayName: string;
  pendingDebt: number;
  pendingLoan: number;
  netOwed: number;
  pendingCount: number;
  settledCount: number;
}

/**
 * Repository abstract for the `debts_loans` module.
 *
 * Methods that mutate the pool indirectly (e.g. settle) accept an
 * optional `manager: EntityManager` so the use case can wrap its writes
 * in `repo.manager.transaction()` and pass the same tx into
 * `CurrencyPoolService.applyDelta` — keeping the row save + pool delta
 * atomic.
 */
export abstract class DebtLoanRepository {
  abstract findByUserId(userId: string, statusFilter: DebtLoanStatusFilter): Promise<DebtLoan[]>;

  abstract findById(id: string): Promise<DebtLoan | null>;

  /**
   * Aggregate by `(LOWER(unaccent(reference)), currency)` — same
   * grouping as the legacy implementation so display contracts hold.
   */
  abstract aggregateByReference(
    userId: string,
    statusFilter: DebtLoanStatusFilter,
  ): Promise<DebtsSummaryRow[]>;

  /**
   * Find all PENDING rows for a normalized reference (and optional
   * currency filter). Used by the bulk-settle-by-reference use case.
   */
  abstract findPendingByNormalizedReference(
    userId: string,
    reference: string,
    currency?: Currency,
  ): Promise<DebtLoan[]>;

  abstract save(debt: DebtLoan, manager?: EntityManager): Promise<DebtLoan>;

  /**
   * Soft-delete by id. Does NOT touch the currency pool — if the row
   * had a real-payment settle applied, the caller is responsible for
   * reverting that pool delta in its own transaction.
   */
  abstract softDelete(id: string, manager?: EntityManager): Promise<void>;

  /**
   * Find all rows (any status, excluding soft-deleted) whose
   * `sourceMonthlyServicePaymentId` is one of `paymentIds`. Used by:
   *   - the monthly-service get/list use cases to surface `linkedDebts[]`
   *   - the delete-payment use case to cascade soft-delete UNSETTLED
   *     linked rows on payment revert
   */
  abstract findBySourcePaymentIds(
    paymentIds: string[],
    manager?: EntityManager,
  ): Promise<DebtLoan[]>;
}
