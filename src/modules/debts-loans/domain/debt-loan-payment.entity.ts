import { type Currency } from '@common/enums/currency.enum';

/**
 * Domain entity for a single settlement payment applied to a
 * `DebtLoan`. Phase 1 of the `payment-history` feature: previously
 * `DebtLoan` only kept the aggregated `remainingAmount`, with no
 * per-event audit trail. Each call to `SettleDebtLoanUseCase` now
 * persists one of these rows so the UI can render the history of
 * partial settlements.
 *
 * Semantics:
 *   - One row per successful settle event. `amount` is the magnitude
 *     of THAT settlement (NOT the remaining balance).
 *   - `currency` is null when the settle was an informal-close (no
 *     real money moved through the pool). When set, it mirrors the
 *     parent `DebtLoan.currency` (the settle use case enforces the
 *     match before inserting). `currency` is immutable post-create —
 *     Phase 2 edit cannot change it (would change pool mode).
 *   - `note` is editable in Phase 2 (and may be set to null to clear it).
 *   - `paidAt` is WHEN THE MONEY MOVED, and is editable. `createdAt` is when
 *     this row was written and stays immutable — conflating the two would
 *     mean backdating a payment silently rewrites the audit trail. They are
 *     equal at creation and only diverge when the user corrects the date
 *     afterwards.
 *   - `applyEdit` covers `amount`, `note` and `paidAt`; `id`, `debtLoanId`,
 *     `currency` and `createdAt` remain immutable.
 */
export class DebtLoanPayment {
  constructor(
    readonly id: string,
    readonly debtLoanId: string,
    public amount: number,
    readonly currency: Currency | null,
    public note: string | null,
    readonly createdAt: Date,
    public paidAt: Date,
  ) {}

  /**
   * Apply an in-place edit to `amount`, `note` and/or `paidAt`.
   * Caller validates business rules (positivity, no-overpayment,
   * at-least-one-field-present) BEFORE invoking. `currency` is NOT
   * editable: changing it would flip pool/no-pool mode, which is
   * out of scope for the edit endpoint. Neither is `createdAt` — see the
   * class doc on why it must not follow `paidAt`.
   */
  applyEdit(partial: { amount?: number; note?: string | null; paidAt?: Date }): void {
    if (partial.amount !== undefined) {
      this.amount = round2(partial.amount);
    }
    if (partial.note !== undefined) {
      this.note = partial.note;
    }
    if (partial.paidAt !== undefined) {
      this.paidAt = partial.paidAt;
    }
  }
}

/** 2-decimal rounding to keep money math sane across JS floats. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
