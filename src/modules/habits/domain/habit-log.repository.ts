import type { HabitLog } from './habit-log.entity';

export abstract class HabitLogRepository {
  abstract findByHabitIdAndDate(habitId: string, date: Date): Promise<HabitLog | null>;
  abstract findByHabitId(
    habitId: string,
    dateFrom?: Date,
    dateTo?: Date,
    page?: number,
    limit?: number,
  ): Promise<{ data: HabitLog[]; total: number }>;
  abstract findByUserIdAndDate(userId: string, date: Date): Promise<HabitLog[]>;
  abstract findCompletedByHabitIdSince(habitId: string, since: Date): Promise<HabitLog[]>;
  abstract save(log: HabitLog): Promise<HabitLog>;
  abstract softDeleteByHabitId(habitId: string): Promise<void>;
}
