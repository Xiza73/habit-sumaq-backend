import { randomUUID } from 'node:crypto';

import { Currency } from '@common/enums/currency.enum';

import { DebtLoan } from '../debt-loan.entity';
import { DebtLoanStatus } from '../enums/debt-loan-status.enum';
import { DebtLoanType } from '../enums/debt-loan-type.enum';

/**
 * Test factory with PENDING DEBT defaults — the most common shape in
 * test scenarios. Override per spec needs.
 */
export function buildDebtLoan(
  overrides: Partial<{
    id: string;
    userId: string;
    type: DebtLoanType;
    categoryId: string | null;
    currency: Currency;
    amount: number;
    remainingAmount: number;
    status: DebtLoanStatus;
    reference: string;
    description: string | null;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    sourceMonthlyServicePaymentId: string | null;
  }> = {},
): DebtLoan {
  const amount = overrides.amount ?? 100;
  return new DebtLoan(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-1',
    overrides.type ?? DebtLoanType.DEBT,
    overrides.categoryId ?? null,
    overrides.currency ?? Currency.PEN,
    amount,
    overrides.remainingAmount ?? amount,
    overrides.status ?? DebtLoanStatus.PENDING,
    overrides.reference ?? 'Juan',
    overrides.description ?? null,
    overrides.date ?? new Date('2026-01-15T12:00:00.000Z'),
    overrides.createdAt ?? new Date('2026-01-15T12:00:00.000Z'),
    overrides.updatedAt ?? new Date('2026-01-15T12:00:00.000Z'),
    overrides.deletedAt ?? null,
    overrides.sourceMonthlyServicePaymentId ?? null,
  );
}
