import { randomUUID } from 'node:crypto';

import { ChoreLog } from '../chore-log.entity';

export function buildChoreLog(
  overrides: Partial<{
    id: string;
    choreId: string;
    doneAt: string;
    note: string | null;
    createdAt: Date;
  }> = {},
): ChoreLog {
  return new ChoreLog(
    overrides.id ?? randomUUID(),
    overrides.choreId ?? 'chore-test-id',
    overrides.doneAt ?? '2026-04-15',
    overrides.note !== undefined ? overrides.note : null,
    overrides.createdAt ?? new Date('2026-04-15T12:00:00Z'),
  );
}
