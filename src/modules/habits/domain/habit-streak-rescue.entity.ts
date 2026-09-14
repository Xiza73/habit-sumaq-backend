/**
 * One period a user spent a streak shield on.
 *
 * Deliberately NOT a `habit_logs` row. A streak is derived from the logs on
 * every read, so writing a synthetic completed log would bridge the streak —
 * and quietly inflate the completion rate, the calendar and the longest
 * streak with a day the user never did. Keeping rescues in their own table
 * lets `StatsCalculator` bridge the streak while every honesty metric keeps
 * reading the logs alone.
 */
export class HabitStreakRescue {
  constructor(
    public readonly id: string,
    public readonly habitId: string,
    public readonly userId: string,
    /**
     * The rescued day as `YYYY-MM-DD`. For a WEEKLY habit this is the Monday
     * of the rescued week.
     *
     * A date rather than a period key (`2026-W37`) so a habit that later
     * switches DAILY↔WEEKLY still resolves its old rescues — the date goes
     * through the same helpers the logs do, whatever the frequency is now.
     */
    public readonly rescuedDate: string,
    public readonly createdAt: Date,
  ) {}
}
