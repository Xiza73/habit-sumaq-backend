import { randomUUID } from 'node:crypto';

import { type TransactionStatus } from '../enums/transaction-status.enum';
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
    reference: string | null;
    status: TransactionStatus | null;
    relatedTransactionId: string | null;
    remainingAmount: number | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    monthlyServiceId: string | null;
    budgetId: string | null;
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
    overrides.reference !== undefined ? overrides.reference : null,
    overrides.status !== undefined ? overrides.status : null,
    overrides.relatedTransactionId !== undefined ? overrides.relatedTransactionId : null,
    overrides.remainingAmount !== undefined ? overrides.remainingAmount : null,
    overrides.createdAt ?? new Date('2026-01-15T12:00:00Z'),
    overrides.updatedAt ?? new Date('2026-01-15T12:00:00Z'),
    overrides.deletedAt !== undefined ? overrides.deletedAt : null,
    overrides.monthlyServiceId !== undefined ? overrides.monthlyServiceId : null,
    overrides.budgetId !== undefined ? overrides.budgetId : null,
  );
}
