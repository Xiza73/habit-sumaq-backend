export class HabitLog {
  constructor(
    readonly id: string,
    readonly habitId: string,
    readonly userId: string,
    public date: string,
    public count: number,
    public completed: boolean,
    public note: string | null,
    readonly createdAt: Date,
    public updatedAt: Date,
    /**
     * The target that applied to THIS day, snapshotted when the log was
     * written. Reading it off the habit instead meant that raising a habit's
     * target rewrote every past day's denominator: days the user had genuinely
     * finished started reading as "3/4".
     *
     * Only DAILY habits use it for period completion — a WEEKLY habit's target
     * belongs to the week, not to any single log, so those still measure the
     * week's sum against the habit.
     *
     * Deliberately REQUIRED, with no default. A default of 1 silently capped
     * every count at 1 for any caller that forgot to pass it — a wrong number
     * shown as if it were right. The column is NOT NULL in the database, so
     * there is no real row that lacks one either.
     */
    public targetCount: number,
  ) {}

  /**
   * Apply a new count for this day, optionally moving the day's own target.
   *
   * `count` is capped at the target, which is what makes the target recoverable
   * from a completed log: `completed` implies `count === targetCount`.
   */
  updateCount(count: number, targetCount: number): void {
    this.targetCount = targetCount;
    this.count = Math.min(count, targetCount);
    this.completed = count >= targetCount;
    this.updatedAt = new Date();
  }

  isCompleted(): boolean {
    return this.completed;
  }
}
