import { type Currency } from '@modules/accounts/domain/enums/currency.enum';

import { type DateFormat } from './enums/date-format.enum';
import { type Language } from './enums/language.enum';
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
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  update(partial: {
    language?: Language;
    theme?: Theme;
    defaultCurrency?: Currency;
    dateFormat?: DateFormat;
    startOfWeek?: StartOfWeek;
  }): void {
    if (partial.language !== undefined) this.language = partial.language;
    if (partial.theme !== undefined) this.theme = partial.theme;
    if (partial.defaultCurrency !== undefined) this.defaultCurrency = partial.defaultCurrency;
    if (partial.dateFormat !== undefined) this.dateFormat = partial.dateFormat;
    if (partial.startOfWeek !== undefined) this.startOfWeek = partial.startOfWeek;
    this.updatedAt = new Date();
  }
}
