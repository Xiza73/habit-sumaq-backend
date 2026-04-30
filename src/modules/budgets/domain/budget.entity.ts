/**
 * Monthly discretionary spending plan, scoped to a single (year, month, currency).
 *
 * The user explicitly creates a budget for a given month + currency and feeds
 * it via "movements" — each movement is a regular EXPENSE transaction with
 * `budgetId` pointing back here. The budget DOES NOT pull in every expense of
 * the month; only the ones the user chose to log against it. This is the key
 * distinction from a "spending tracker" — it is a planning tool for things
 * the user wants to keep an eye on, separate from recurring/fixed costs.
 *
 * Identity: `(userId, year, month, currency)` is unique among non-soft-deleted
 * rows. A user can have multiple budgets in the same month if they're in
 * different currencies (e.g. one for PEN and one for USD).
 */
export class Budget {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly year: number,
    readonly month: number,
    readonly currency: string,
    public amount: number,
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  /**
   * Period as `YYYY-MM` — handy for ordering history lists and comparing
   * against `currentPeriodInTimezone`.
   */
  get period(): string {
    return `${this.year}-${String(this.month).padStart(2, '0')}`;
  }

  /**
   * True when `date` falls within the budget's calendar month, in the budget's
   * implicit (year, month) frame. The caller is expected to have already
   * adjusted the date to the user's timezone if that matters — the DTO
   * validation does that before invoking this check.
   */
  containsDate(date: Date): boolean {
    return date.getUTCFullYear() === this.year && date.getUTCMonth() + 1 === this.month;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  setAmount(amount: number): void {
    this.amount = amount;
    this.updatedAt = new Date();
  }
}
