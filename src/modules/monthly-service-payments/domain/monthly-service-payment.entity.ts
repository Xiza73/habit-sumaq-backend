import { type Currency } from '@common/enums/currency.enum';

/**
 * Native domain entity for the v1.0.0 `monthly_service_payments`
 * module (Phase A4-B of the `accounts-to-modular-finance` refactor).
 * Replaces the EXPENSE subset of legacy `transactions` rows where
 * `monthlyServiceId IS NOT NULL` — these were "paid this service for
 * some month" tracked indirectly via the transactions table.
 *
 * Why split out:
 *   - The legacy model coupled the payment to an `accountId` because
 *     the same row debited a bank account. In v1.0.0 the account
 *     abstraction disappears — money flows through the internal
 *     `currency_pools` instead.
 *   - The legacy didn't explicitly track WHICH PERIOD was paid for.
 *     It tracked the side-effect (`monthlyService.lastPaidPeriod`).
 *     That meant back-paying months or paying out of order required
 *     the use case to interpret each payment indirectly. The new
 *     entity makes the `period` a first-class column, so a service
 *     can have multiple payments for distinct periods and each is
 *     explicit.
 *
 * Semantics:
 *   - `(monthlyServiceId, period)` is unique among non-deleted rows
 *     (DB constraint). You can't pay the same service for the same
 *     month twice — to "redo" a payment, delete + recreate.
 *   - Creating a payment DEBITS the user's currency pool by `amount`.
 *   - Deleting a payment REFUNDS the pool by `amount`.
 *   - `userId`, `monthlyServiceId`, `currency`, `period` are
 *     IMMUTABLE post-creation. To change any of them, delete +
 *     recreate (so both pool deltas get recorded explicitly).
 */
export class MonthlyServicePayment {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly monthlyServiceId: string,
    readonly currency: Currency,
    public amount: number,
    /** YYYY-MM format. Enforced by DB CHECK + entity validation. */
    readonly period: string,
    public description: string | null,
    public date: Date,
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  /**
   * Update mutable fields. Only `amount`, `description`, `date`. The
   * use case enforces that an amount change triggers the matching
   * pool delta atomically.
   */
  update(partial: { amount?: number; description?: string | null; date?: Date }): void {
    if (partial.amount !== undefined) this.amount = round2(partial.amount);
    if (partial.description !== undefined) this.description = partial.description;
    if (partial.date !== undefined) this.date = partial.date;
    this.updatedAt = new Date();
  }
}

/** 2-decimal rounding to keep money math sane across JS floats. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Validates the `YYYY-MM` shape. Use the entity's own check + DB's
 * regex CHECK as defense in depth. The use case calls this BEFORE
 * constructing the entity, so a bad period rejects cleanly with the
 * `INVALID_PERIOD_FORMAT` code.
 */
export function isValidPeriodFormat(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}
