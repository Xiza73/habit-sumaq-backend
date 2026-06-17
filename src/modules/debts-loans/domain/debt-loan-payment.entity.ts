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
 *   - Phase 2 adds `applyEdit` for edit support; `id`, `debtLoanId`,
 *     `currency`, and `createdAt` remain immutable.
 */
export class DebtLoanPayment {
  constructor(
    readonly id: string,
    readonly debtLoanId: string,
    public amount: number,
    readonly currency: Currency | null,
    public note: string | null,
    readonly createdAt: Date,
  ) {}

  /**
   * Phase 2 — apply an in-place edit to `amount` and/or `note`.
   * Caller validates business rules (positivity, no-overpayment,
   * at-least-one-field-present) BEFORE invoking. `currency` is NOT
   * editable: changing it would flip pool/no-pool mode, which is
   * out of scope for the edit endpoint.
   */
  applyEdit(partial: { amount?: number; note?: string | null }): void {
    if (partial.amount !== undefined) {
      this.amount = round2(partial.amount);
    }
    if (partial.note !== undefined) {
      this.note = partial.note;
    }
  }
}

/** 2-decimal rounding to keep money math sane across JS floats. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
