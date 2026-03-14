import { randomUUID } from 'node:crypto';

import { HabitLog } from '../habit-log.entity';

export function buildHabitLog(
  overrides: Partial<{
    id: string;
    habitId: string;
    userId: string;
    date: string;
    count: number;
    completed: boolean;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): HabitLog {
  return new HabitLog(
    overrides.id ?? randomUUID(),
    overrides.habitId ?? 'habit-test-id',
    overrides.userId ?? 'user-test-id',
    overrides.date ?? '2026-03-13',
    overrides.count ?? 0,
    overrides.completed ?? false,
    overrides.note !== undefined ? overrides.note : null,
    overrides.createdAt ?? new Date('2026-01-01T00:00:00Z'),
    overrides.updatedAt ?? new Date('2026-01-01T00:00:00Z'),
  );
}
