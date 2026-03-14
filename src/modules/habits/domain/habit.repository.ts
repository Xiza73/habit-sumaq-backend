import type { Habit } from './habit.entity';

export abstract class HabitRepository {
  abstract findByUserId(userId: string, includeArchived?: boolean): Promise<Habit[]>;
  abstract findByUserIdAndName(userId: string, name: string): Promise<Habit | null>;
  abstract findById(id: string): Promise<Habit | null>;
  abstract save(habit: Habit): Promise<Habit>;
  abstract softDelete(id: string): Promise<void>;
}
