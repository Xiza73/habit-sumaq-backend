import type { HabitStreakRescue } from './habit-streak-rescue.entity';

export abstract class HabitStreakRescueRepository {
  /**
   * Every rescue for a habit, as plain `YYYY-MM-DD` strings.
   *
   * Returns the dates rather than the entities because that is all
   * `StatsCalculator` needs, and the stats path runs on every habit read —
   * no reason to hydrate rows nobody looks at.
   *
   * Like `findCompletedByHabitId`, this takes no date floor on purpose: a
   * streak has no upper bound, so cutting the fetch at N days would silently
   * un-bridge older rescues.
   */
  abstract findDatesByHabitId(habitId: string): Promise<string[]>;

  /** Same, for many habits at once — the list and dashboard views. */
  abstract findDatesByHabitIds(habitIds: string[]): Promise<Map<string, string[]>>;

  /**
   * Records a rescue.
   *
   * Rescuing the same period twice is prevented by the UNIQUE on
   * `(habitId, rescuedDate)`, not by a check here — a constraint cannot be
   * forgotten by a future caller.
   */
  abstract create(habitId: string, userId: string, rescuedDate: string): Promise<HabitStreakRescue>;

  /**
   * Removes a rescue, so the shield spent on it can be handed back.
   *
   * Exists because a rescued period is not a completed one: the user can still
   * go and actually log that day. When they do, the shield paid for nothing —
   * and with no way to undo a rescue it was gone for good.
   *
   * Returns whether a row was actually removed, so the caller can refuse to
   * refund a shield for a rescue that was not there.
   */
  abstract deleteByHabitIdAndDate(habitId: string, rescuedDate: string): Promise<boolean>;
}
