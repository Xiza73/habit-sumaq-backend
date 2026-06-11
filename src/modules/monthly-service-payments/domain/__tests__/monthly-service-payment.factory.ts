import { randomUUID } from 'node:crypto';

import { Currency } from '@common/enums/currency.enum';

import { MonthlyServicePayment } from '../monthly-service-payment.entity';

/**
 * Test factory with sensible defaults: a PEN payment of 50 against a
 * placeholder serviceId, period 2026-06.
 */
export function buildMonthlyServicePayment(
  overrides: Partial<{
    id: string;
    userId: string;
    monthlyServiceId: string;
    currency: Currency;
    amount: number;
    period: string;
    description: string | null;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }> = {},
): MonthlyServicePayment {
  return new MonthlyServicePayment(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-1',
    overrides.monthlyServiceId ?? 'service-1',
    overrides.currency ?? Currency.PEN,
    overrides.amount ?? 50,
    overrides.period ?? '2026-06',
    overrides.description ?? null,
    overrides.date ?? new Date('2026-06-15T12:00:00.000Z'),
    overrides.createdAt ?? new Date('2026-06-15T12:00:00.000Z'),
    overrides.updatedAt ?? new Date('2026-06-15T12:00:00.000Z'),
    overrides.deletedAt ?? null,
  );
}
