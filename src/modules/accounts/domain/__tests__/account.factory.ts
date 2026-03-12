import { randomUUID } from 'node:crypto';

import { Account } from '../account.entity';
import { AccountType } from '../enums/account-type.enum';
import { Currency } from '../enums/currency.enum';

export function buildAccount(overrides: Partial<Account> = {}): Account {
  return new Account(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-test-id',
    overrides.name ?? 'Cuenta Test',
    overrides.type ?? AccountType.CHECKING,
    overrides.currency ?? Currency.PEN,
    overrides.balance ?? 0,
    overrides.color ?? null,
    overrides.icon ?? null,
    overrides.isArchived ?? false,
    overrides.createdAt ?? new Date('2026-01-01'),
    overrides.updatedAt ?? new Date('2026-01-01'),
    overrides.deletedAt ?? null,
  );
}
