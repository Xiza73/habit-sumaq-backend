import { randomUUID } from 'node:crypto';

import { Currency } from '@common/enums/currency.enum';

import { BudgetMovement } from '../budget-movement.entity';

/**
 * Test factory for `BudgetMovement` with sensible defaults. The default
 * shape is a PEN expense of 100 against a placeholder budgetId.
 */
export function buildBudgetMovement(
  overrides: Partial<{
    id: string;
    userId: string;
    budgetId: string;
    categoryId: string | null;
    currency: Currency;
    amount: number;
    description: string | null;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }> = {},
): BudgetMovement {
  return new BudgetMovement(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-1',
    overrides.budgetId ?? 'budget-1',
    overrides.categoryId ?? null,
    overrides.currency ?? Currency.PEN,
    overrides.amount ?? 100,
    overrides.description ?? null,
    overrides.date ?? new Date('2026-06-15T12:00:00.000Z'),
    overrides.createdAt ?? new Date('2026-06-15T12:00:00.000Z'),
    overrides.updatedAt ?? new Date('2026-06-15T12:00:00.000Z'),
    overrides.deletedAt ?? null,
  );
}
