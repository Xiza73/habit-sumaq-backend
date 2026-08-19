import type { HabitLog } from './habit-log.entity';

export abstract class HabitLogRepository {
  abstract findByHabitIdAndDate(habitId: string, date: string): Promise<HabitLog | null>;
  abstract findByHabitId(
    habitId: string,
    dateFrom?: string,
    dateTo?: string,
    page?: number,
    limit?: number,
  ): Promise<{ data: HabitLog[]; total: number }>;
  abstract findByUserIdAndDate(userId: string, date: string): Promise<HabitLog[]>;
  /**
   * Completed logs for a habit, oldest first.
   *
   * `since` is OPTIONAL and omitting it means the whole history. Streaks have
   * no natural upper bound, so the stats callers must not pass one — capping
   * the fetch at 30 days is what made a 45-day streak report as 30, since the
   * calculator simply never saw the older logs.
   *
   * Volume is one row per habit per day, so a multi-year history is still in
   * the low thousands of rows.
   */
  abstract findCompletedByHabitId(habitId: string, since?: string): Promise<HabitLog[]>;
  abstract findByHabitIdAndDateRange(
    habitId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<HabitLog[]>;
  abstract save(log: HabitLog): Promise<HabitLog>;
  abstract softDeleteByHabitId(habitId: string): Promise<void>;
}
