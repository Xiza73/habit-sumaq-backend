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
  abstract findCompletedByHabitIdSince(habitId: string, since: string): Promise<HabitLog[]>;
  abstract findByHabitIdAndDateRange(
    habitId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<HabitLog[]>;
  abstract save(log: HabitLog): Promise<HabitLog>;
  abstract softDeleteByHabitId(habitId: string): Promise<void>;
}
