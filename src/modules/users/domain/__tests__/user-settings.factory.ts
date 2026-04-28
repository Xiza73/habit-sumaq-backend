import { randomUUID } from 'node:crypto';

import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { DateFormat } from '../enums/date-format.enum';
import { Language } from '../enums/language.enum';
import { MonthlyServicesGroupBy } from '../enums/monthly-services-group-by.enum';
import { MonthlyServicesOrderBy } from '../enums/monthly-services-order-by.enum';
import { MonthlyServicesOrderDir } from '../enums/monthly-services-order-dir.enum';
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
    overrides.monthlyServicesGroupBy ?? MonthlyServicesGroupBy.NONE,
    overrides.monthlyServicesOrderBy ?? MonthlyServicesOrderBy.NAME,
    overrides.monthlyServicesOrderDir ?? MonthlyServicesOrderDir.ASC,
    overrides.createdAt ?? new Date('2026-01-01'),
    overrides.updatedAt ?? new Date('2026-01-01'),
  );
}
