import { type Currency } from '@modules/accounts/domain/enums/currency.enum';

import { type DateFormat } from './enums/date-format.enum';
import { type Language } from './enums/language.enum';
import { type MonthlyServicesGroupBy } from './enums/monthly-services-group-by.enum';
import { type MonthlyServicesOrderBy } from './enums/monthly-services-order-by.enum';
import { type MonthlyServicesOrderDir } from './enums/monthly-services-order-dir.enum';
import { type StartOfWeek } from './enums/start-of-week.enum';
import { type Theme } from './enums/theme.enum';

export class UserSettings {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public language: Language,
    public theme: Theme,
    public defaultCurrency: Currency,
    public dateFormat: DateFormat,
    public startOfWeek: StartOfWeek,
    public timezone: string,
    // Monthly-services view preferences. Persisted here (instead of a separate
    // preferences table) because every other UI preference lives in user_settings.
    public monthlyServicesGroupBy: MonthlyServicesGroupBy,
    public monthlyServicesOrderBy: MonthlyServicesOrderBy,
    public monthlyServicesOrderDir: MonthlyServicesOrderDir,
    /**
     * User-picked keys (max 4) that drive the mobile bottom nav and the
     * "★ favorite" mark in the desktop sidebar. The canonical list of
     * available keys lives in the frontend's `NAV_REGISTRY` — we keep
     * this side dumb-strings on purpose so we don't have to bump backend
     * + frontend in lockstep every time a nav route is added or renamed.
     * Frontend ignores unknown keys gracefully.
     */
    public favoriteKeys: string[],
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  update(partial: {
    language?: Language;
    theme?: Theme;
    defaultCurrency?: Currency;
    dateFormat?: DateFormat;
    startOfWeek?: StartOfWeek;
    timezone?: string;
    monthlyServicesGroupBy?: MonthlyServicesGroupBy;
    monthlyServicesOrderBy?: MonthlyServicesOrderBy;
    monthlyServicesOrderDir?: MonthlyServicesOrderDir;
    favoriteKeys?: string[];
  }): void {
    if (partial.language !== undefined) this.language = partial.language;
    if (partial.theme !== undefined) this.theme = partial.theme;
    if (partial.defaultCurrency !== undefined) this.defaultCurrency = partial.defaultCurrency;
    if (partial.dateFormat !== undefined) this.dateFormat = partial.dateFormat;
    if (partial.startOfWeek !== undefined) this.startOfWeek = partial.startOfWeek;
    if (partial.timezone !== undefined) this.timezone = partial.timezone;
    if (partial.monthlyServicesGroupBy !== undefined)
      this.monthlyServicesGroupBy = partial.monthlyServicesGroupBy;
    if (partial.monthlyServicesOrderBy !== undefined)
      this.monthlyServicesOrderBy = partial.monthlyServicesOrderBy;
    if (partial.monthlyServicesOrderDir !== undefined)
      this.monthlyServicesOrderDir = partial.monthlyServicesOrderDir;
    if (partial.favoriteKeys !== undefined) this.favoriteKeys = partial.favoriteKeys;
    this.updatedAt = new Date();
  }
}
