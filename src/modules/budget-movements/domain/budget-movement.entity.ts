import { type Currency } from '@common/enums/currency.enum';

/**
 * Native domain entity for the v1.0.0 `budget_movements` module
 * (introduced by Phase A4-B of the `accounts-to-modular-finance`
 * refactor). Replaces the EXPENSE subset of legacy `transactions` rows
 * where `budgetId IS NOT NULL` — these were "expenses charged against a
 * budget" tracked indirectly via the transactions table.
 *
 * Why split out:
 *   - The legacy model coupled the movement to an `accountId` because
 *     the same row had to debit a bank account. In v1.0.0 the account
 *     abstraction disappears — money flows through the internal
 *     `currency_pools` instead. A budget movement now records "I spent
 *     X PEN against budget Y", and the pool debit happens implicitly
 *     via `CurrencyPoolService.applyDelta`.
 *   - No more `relatedTransactionId` chains for settlements. A movement
 *     is a single atomic record.
 *
 * Semantics (locked by D3 in the proposal):
 *   - Every movement is an EXPENSE-style debit to the user's pool of
 *     `currency`. There is no "income movement" — that's a separate
 *     concept that lives in the `monthly_service_payments` /
 *     `debts_loans` modules for now.
 *   - The `(budgetId, date)` pair must fall inside the budget's
 *     `(year, month, currency)` window. The use case enforces this; the
 *     entity stays naive about which budget it belongs to.
 *   - Soft-delete via `deletedAt` per CLAUDE.md rule #7.
 */
export class BudgetMovement {
  constructor(
    readonly id: string,
    readonly userId: string,
    public budgetId: string,
    public categoryId: string | null,
    public currency: Currency,
    public amount: number,
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
   * Update the editable fields. `budgetId`, `currency`, and `userId` are
   * IMMUTABLE post-creation — to move a movement to another budget or
   * currency, delete + recreate (so the pool deltas of both sides are
   * recorded explicitly). The use case enforces this; the entity just
   * accepts the partial.
   */
  update(partial: {
    amount?: number;
    description?: string | null;
    date?: Date;
    categoryId?: string | null;
  }): void {
    if (partial.amount !== undefined) this.amount = round2(partial.amount);
    if (partial.description !== undefined) this.description = partial.description;
    if (partial.date !== undefined) this.date = partial.date;
    if (partial.categoryId !== undefined) this.categoryId = partial.categoryId;
    this.updatedAt = new Date();
  }
}

/** 2-decimal rounding to keep money math sane across JS floats. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
