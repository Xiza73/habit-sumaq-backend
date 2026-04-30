import { randomUUID } from 'node:crypto';

import { Budget } from '../budget.entity';

interface BudgetOverrides {
  id?: string;
  userId?: string;
  year?: number;
  month?: number;
  currency?: string;
  amount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

/**
 * Test factory for Budget. Defaults to "April 2026 PEN, S/ 2000 cap" — a
 * realistic shape that won't bite tests on month-edge math. Override any
 * field per case.
 */
export function makeBudget(overrides: BudgetOverrides = {}): Budget {
  const now = new Date('2026-04-15T12:00:00.000Z');
  return new Budget(
    overrides.id ?? randomUUID(),
    overrides.userId ?? randomUUID(),
    overrides.year ?? 2026,
    overrides.month ?? 4,
    overrides.currency ?? 'PEN',
    overrides.amount ?? 2000,
    overrides.createdAt ?? now,
    overrides.updatedAt ?? now,
    overrides.deletedAt ?? null,
  );
}
