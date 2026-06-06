import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { CurrencyPool } from '../currency-pool.entity';

/**
 * Test factory for `CurrencyPool` with sensible defaults. Override any
 * field via `overrides`.
 */
export function buildCurrencyPool(
  overrides: Partial<{
    id: string;
    userId: string;
    currency: Currency;
    balance: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }> = {},
): CurrencyPool {
  return new CurrencyPool(
    overrides.id ?? 'pool-1',
    overrides.userId ?? 'user-1',
    overrides.currency ?? Currency.PEN,
    overrides.balance ?? 0,
    overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    overrides.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
    overrides.deletedAt ?? null,
  );
}
