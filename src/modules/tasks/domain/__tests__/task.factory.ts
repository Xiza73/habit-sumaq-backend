import { randomUUID } from 'node:crypto';

import { TaskStatus } from '../enums/task-status.enum';
import { Task } from '../task.entity';

interface TaskOverrides {
  id?: string;
  userId?: string;
  sectionId?: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  completedAt?: Date | null;
  position?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export function makeTask(overrides: TaskOverrides = {}): Task {
  const now = new Date('2026-04-15T12:00:00.000Z');
  return new Task(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-test-id',
    overrides.sectionId ?? 'section-test-id',
    overrides.title ?? 'Comprar pan',
    overrides.description !== undefined ? overrides.description : null,
    overrides.status ?? TaskStatus.PENDING,
    overrides.completedAt !== undefined ? overrides.completedAt : null,
    overrides.position ?? 1,
    overrides.createdAt ?? now,
    overrides.updatedAt ?? now,
  );
}
