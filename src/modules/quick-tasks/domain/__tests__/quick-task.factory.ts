import { randomUUID } from 'node:crypto';

import { QuickTask } from '../quick-task.entity';

export function buildQuickTask(overrides: Partial<QuickTask> = {}): QuickTask {
  return new QuickTask(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-1',
    overrides.title ?? 'Comprar leche',
    overrides.description === undefined ? null : overrides.description,
    overrides.completed ?? false,
    overrides.completedAt === undefined ? null : overrides.completedAt,
    overrides.position ?? 0,
    overrides.createdAt ?? new Date('2026-01-01'),
    overrides.updatedAt ?? new Date('2026-01-01'),
  );
}
