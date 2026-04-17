import { randomUUID } from 'node:crypto';

import { HabitFrequency } from '../enums/habit-frequency.enum';
import { Habit } from '../habit.entity';

/**
 * Fábrica de test para la entidad `Habit`.
 *
 * ⚠️ `targetCount` pasa por el invariante de dominio `Habit.assertTargetCount`
 * en el constructor. Valores inválidos (`< 1`, negativos, no enteros) lanzan
 * `DomainException('INVALID_TARGET_COUNT')`. Esto es intencional: los tests
 * que verifiquen el invariante pueden usar esta fábrica con valores inválidos
 * y esperar el throw. Los tests que necesiten un `Habit` válido deben omitir
 * el override o pasar un entero `>= 1`.
 */
export function buildHabit(
  overrides: Partial<{
    id: string;
    userId: string;
    name: string;
    description: string | null;
    frequency: HabitFrequency;
    targetCount: number;
    color: string | null;
    icon: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }> = {},
): Habit {
  return new Habit(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-test-id',
    overrides.name ?? 'Tomar agua',
    overrides.description !== undefined ? overrides.description : null,
    overrides.frequency ?? HabitFrequency.DAILY,
    overrides.targetCount ?? 8,
    overrides.color !== undefined ? overrides.color : null,
    overrides.icon !== undefined ? overrides.icon : null,
    overrides.isArchived ?? false,
    overrides.createdAt ?? new Date('2026-01-01T00:00:00Z'),
    overrides.updatedAt ?? new Date('2026-01-01T00:00:00Z'),
    overrides.deletedAt !== undefined ? overrides.deletedAt : null,
  );
}
