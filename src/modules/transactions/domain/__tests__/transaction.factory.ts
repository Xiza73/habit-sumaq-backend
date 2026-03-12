import { randomUUID } from 'node:crypto';

import { TransactionType } from '../enums/transaction-type.enum';
import { Transaction } from '../transaction.entity';

export function buildTransaction(
  overrides: Partial<{
    id: string;
    userId: string;
    accountId: string;
    categoryId: string | null;
    type: TransactionType;
    amount: number;
    description: string | null;
    date: Date;
    destinationAccountId: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }> = {},
): Transaction {
  return new Transaction(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-test-id',
    overrides.accountId ?? 'account-test-id',
    overrides.categoryId !== undefined ? overrides.categoryId : 'category-test-id',
    overrides.type ?? TransactionType.EXPENSE,
    overrides.amount ?? 100,
    overrides.description !== undefined ? overrides.description : 'Compra de almuerzo',
    overrides.date ?? new Date('2026-01-15T12:00:00Z'),
    overrides.destinationAccountId !== undefined ? overrides.destinationAccountId : null,
    overrides.createdAt ?? new Date('2026-01-15T12:00:00Z'),
    overrides.updatedAt ?? new Date('2026-01-15T12:00:00Z'),
    overrides.deletedAt !== undefined ? overrides.deletedAt : null,
  );
}
