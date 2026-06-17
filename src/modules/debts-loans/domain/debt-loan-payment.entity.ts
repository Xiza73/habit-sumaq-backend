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
 *     match before inserting).
 *   - `note` is reserved for Phase 2 (edit/delete) — Phase 1 always
 *     writes null.
 *   - Immutable from the domain's perspective in Phase 1 — there are
 *     no mutators. Edit/delete come in Phase 2.
 */
export class DebtLoanPayment {
  constructor(
    readonly id: string,
    readonly debtLoanId: string,
    readonly amount: number,
    readonly currency: Currency | null,
    readonly note: string | null,
    readonly createdAt: Date,
  ) {}
}
