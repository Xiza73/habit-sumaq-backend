import { randomUUID } from 'node:crypto';

import { type Currency } from '@common/enums/currency.enum';

/**
 * Internal-only aggregate balance per `(userId, currency)`. NEVER exposed
 * via any HTTP response — the user does not see this entity. It exists
 * solely so the new outcome-driven modules (budget_movements,
 * monthly_service_payments, debts_loans real-payment settles) can record
 * "how much money flowed" without an `accounts` table to mutate.
 *
 * Mutation entry point is `applyDelta` — the service layer wraps the
 * read+modify+write in a `pessimistic_write` lock so concurrent updates
 * (e.g. user with two browser tabs) cannot race.
 *
 * Auto-created with `balance = 0` on first delta by the service when
 * missing for `(userId, currency)`. Per A1-B.2 the backfill migration
 * seeds rows for every existing user, but auto-create handles edge cases
 * (fresh signup, currency never previously touched).
 *
 * NOTE: `Currency` is still imported from `@modules/accounts` today —
 * Phase A2 moves the enum to `@common/` and this import will be rewritten
 * mechanically. We accept the temporary cross-module reference instead of
 * doing A2 first, because A1's "module skeleton" is the smaller change.
 */
export class CurrencyPool {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly currency: Currency,
    public balance: number,
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  /**
   * Apply a signed delta to the balance. Positive = credit (money in),
   * negative = debit (money out). Rounds to 2 decimal places to keep
   * money math sane across JS floats.
   *
   * Callers MUST hold a pessimistic_write lock on the row before
   * computing the new balance, otherwise concurrent applyDelta calls
   * will drift. The service layer is responsible for that lock.
   */
  applyDelta(delta: number): void {
    this.balance = round2(this.balance + delta);
    this.updatedAt = new Date();
  }

  /**
   * Factory for the auto-create path: when `applyDelta` runs and no pool
   * row exists for `(userId, currency)`, the service builds a fresh
   * zero-balance row with this helper before applying the delta.
   */
  static newWithZeroBalance(userId: string, currency: Currency): CurrencyPool {
    const now = new Date();
    return new CurrencyPool(randomUUID(), userId, currency, 0, now, now, null);
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}

/** 2-decimal rounding to keep money math sane across JS floats. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
