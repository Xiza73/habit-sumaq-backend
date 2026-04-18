import { randomUUID } from 'node:crypto';

import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { DateFormat } from '../enums/date-format.enum';
import { Language } from '../enums/language.enum';
import { StartOfWeek } from '../enums/start-of-week.enum';
import { Theme } from '../enums/theme.enum';
import { UserSettings } from '../user-settings.entity';

export function buildUserSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return new UserSettings(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-1',
    overrides.language ?? Language.ES,
    overrides.theme ?? Theme.SYSTEM,
    overrides.defaultCurrency ?? Currency.PEN,
    overrides.dateFormat ?? DateFormat.DD_MM_YYYY,
    overrides.startOfWeek ?? StartOfWeek.MONDAY,
    overrides.timezone ?? 'UTC',
    overrides.createdAt ?? new Date('2026-01-01'),
    overrides.updatedAt ?? new Date('2026-01-01'),
  );
}
