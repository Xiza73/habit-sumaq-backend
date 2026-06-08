/**
 * Lifecycle status of a debt or loan.
 *
 *  - `PENDING`: at least some `remainingAmount` is still outstanding.
 *    Settlements (partial or full) reduce `remainingAmount` and keep
 *    `PENDING` until it hits 0.
 *
 *  - `SETTLED`: `remainingAmount` is 0. Editing is restricted (only
 *    `amount` may change, and only above the already-settled total).
 *
 * Stored as `varchar(8) + CHECK` to mirror the type enum's storage
 * decision.
 */
export enum DebtLoanStatus {
  PENDING = 'PENDING',
  SETTLED = 'SETTLED',
}
