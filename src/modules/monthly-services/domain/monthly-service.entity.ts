/**
 * Service the user pays every month (e.g. Netflix, Internet, Gym).
 *
 * The entity tracks the last period it was paid for (`lastPaidPeriod`, format
 * `YYYY-MM`) and uses `startPeriod` as the seed for the very first payment.
 * Helpers below keep the period-arithmetic logic out of use cases.
 */
export class MonthlyService {
  constructor(
    readonly id: string,
    readonly userId: string,
    public name: string,
    public defaultAccountId: string,
    public categoryId: string,
    // No longer readonly — when the user moves the service to a default
    // account in a different currency, the service "moves" to that currency
    // too (handled in UpdateMonthlyServiceUseCase).
    public currency: string,
    public estimatedAmount: number | null,
    public dueDay: number | null,
    readonly startPeriod: string,
    public lastPaidPeriod: string | null,
    public isActive: boolean,
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  /**
   * The next `YYYY-MM` the service should be paid for. If it has never been
   * paid, this is `startPeriod`; otherwise it is `lastPaidPeriod + 1 month`.
   */
  nextDuePeriod(): string {
    return this.lastPaidPeriod ? MonthlyService.addMonth(this.lastPaidPeriod) : this.startPeriod;
  }

  /**
   * True when the next due period is strictly earlier than the user's current
   * month (in their timezone) — the frontend shows these services as overdue.
   */
  isOverdueFor(currentPeriod: string): boolean {
    return this.nextDuePeriod() < currentPeriod;
  }

  /**
   * True when the service has already been paid for the current month — the
   * next due period is strictly in the future.
   */
  isPaidForMonth(currentPeriod: string): boolean {
    return this.nextDuePeriod() > currentPeriod;
  }

  /**
   * Advances `lastPaidPeriod` to the given period. Used by both the "pay" and
   * "skip" flows — they only differ in whether they also create a transaction.
   */
  markPeriodAsPaid(period: string): void {
    this.lastPaidPeriod = period;
    this.updatedAt = new Date();
  }

  toggleActive(): void {
    this.isActive = !this.isActive;
    this.updatedAt = new Date();
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  /**
   * Adds one month to a `YYYY-MM` string, rolling the year when needed.
   * Kept as a static so use cases and tests can reuse it without instantiating.
   */
  static addMonth(period: string): string {
    const [yearStr, monthStr] = period.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (month === 12) {
      return `${year + 1}-01`;
    }
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
}
