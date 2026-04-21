import { randomUUID } from 'node:crypto';

import { MonthlyService } from '../monthly-service.entity';

export function buildMonthlyService(
  overrides: Partial<{
    id: string;
    userId: string;
    name: string;
    defaultAccountId: string;
    categoryId: string;
    currency: string;
    estimatedAmount: number | null;
    dueDay: number | null;
    startPeriod: string;
    lastPaidPeriod: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }> = {},
): MonthlyService {
  return new MonthlyService(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-test-id',
    overrides.name ?? 'Netflix',
    overrides.defaultAccountId ?? 'account-test-id',
    overrides.categoryId ?? 'category-test-id',
    overrides.currency ?? 'PEN',
    overrides.estimatedAmount !== undefined ? overrides.estimatedAmount : 45,
    overrides.dueDay !== undefined ? overrides.dueDay : 15,
    overrides.startPeriod ?? '2026-01',
    overrides.lastPaidPeriod !== undefined ? overrides.lastPaidPeriod : null,
    overrides.isActive !== undefined ? overrides.isActive : true,
    overrides.createdAt ?? new Date('2026-01-01T00:00:00Z'),
    overrides.updatedAt ?? new Date('2026-01-01T00:00:00Z'),
    overrides.deletedAt !== undefined ? overrides.deletedAt : null,
  );
}
