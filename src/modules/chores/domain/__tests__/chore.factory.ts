import { randomUUID } from 'node:crypto';

import { Chore } from '../chore.entity';
import { IntervalUnit } from '../enums/interval-unit.enum';

export function buildChore(
  overrides: Partial<{
    id: string;
    userId: string;
    name: string;
    notes: string | null;
    category: string | null;
    intervalValue: number;
    intervalUnit: IntervalUnit;
    startDate: string;
    lastDoneDate: string | null;
    nextDueDate: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }> = {},
): Chore {
  const startDate = overrides.startDate ?? '2026-04-01';
  return new Chore(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-test-id',
    overrides.name ?? 'Lavar sábanas',
    overrides.notes !== undefined ? overrides.notes : null,
    overrides.category !== undefined ? overrides.category : null,
    overrides.intervalValue ?? 2,
    overrides.intervalUnit ?? IntervalUnit.WEEKS,
    startDate,
    overrides.lastDoneDate !== undefined ? overrides.lastDoneDate : null,
    overrides.nextDueDate ?? startDate,
    overrides.isActive !== undefined ? overrides.isActive : true,
    overrides.createdAt ?? new Date('2026-04-01T00:00:00Z'),
    overrides.updatedAt ?? new Date('2026-04-01T00:00:00Z'),
    overrides.deletedAt !== undefined ? overrides.deletedAt : null,
  );
}
