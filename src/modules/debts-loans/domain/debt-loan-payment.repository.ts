import { type EntityManager } from 'typeorm';

import { type DebtLoanPayment } from './debt-loan-payment.entity';

/**
 * Abstract repository for the Phase-1 `debt_loan_payments` table —
 * the per-event audit trail of settlements applied to a `DebtLoan`.
 *
 * `create` accepts an optional `EntityManager` so the settle use case
 * can insert the payment row inside the SAME `dataSource.transaction()`
 * that updates `debt_loans.remainingAmount` (and, in real-payment mode,
 * applies the pool delta) — keeping all three writes atomic.
 */
export abstract class DebtLoanPaymentRepository {
  /**
   * Persists a new payment row. Caller constructs the domain entity
   * (with `id`, `createdAt`) and passes it in; the repo writes it as-is.
   */
  abstract create(payment: DebtLoanPayment, manager?: EntityManager): Promise<DebtLoanPayment>;

  /**
   * Lists payments for `debtLoanId` ordered by `createdAt` DESC (most
   * recent first). Phase 1 has no pagination — the UI shows the full
   * history; per-debt N is bounded in practice.
   */
  abstract findByDebtLoanId(debtLoanId: string): Promise<DebtLoanPayment[]>;

  /**
   * Phase 2 — fetch a single payment by id (or null). Used by edit/delete
   * to load the row + validate ownership through its parent `DebtLoan`.
   */
  abstract findById(id: string, manager?: EntityManager): Promise<DebtLoanPayment | null>;

  /**
   * Phase 2 — update an existing payment row in place. Caller has already
   * mutated the editable fields on the domain entity (`amount`, `note`).
   * Separate from `create` to keep Fase 1 callers untouched.
   */
  abstract update(payment: DebtLoanPayment, manager?: EntityManager): Promise<DebtLoanPayment>;

  /**
   * Phase 2 — hard-delete by id. Payment history is not soft-deletable
   * (no `deletedAt` column) — the row is removed entirely. The caller is
   * responsible for adjusting `remainingAmount` + status on the parent
   * `DebtLoan` and reverting any pool delta inside the same transaction.
   */
  abstract deleteById(id: string, manager?: EntityManager): Promise<void>;
}
