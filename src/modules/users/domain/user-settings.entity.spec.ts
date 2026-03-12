import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { buildUserSettings } from './__tests__/user-settings.factory';
import { DateFormat } from './enums/date-format.enum';
import { Language } from './enums/language.enum';
import { StartOfWeek } from './enums/start-of-week.enum';
import { Theme } from './enums/theme.enum';

describe('UserSettings', () => {
  describe('update', () => {
    it('should update language', () => {
      const settings = buildUserSettings({ language: Language.ES });
      settings.update({ language: Language.EN });
      expect(settings.language).toBe(Language.EN);
    });

    it('should update theme', () => {
      const settings = buildUserSettings({ theme: Theme.SYSTEM });
      settings.update({ theme: Theme.DARK });
      expect(settings.theme).toBe(Theme.DARK);
    });

    it('should update defaultCurrency', () => {
      const settings = buildUserSettings({ defaultCurrency: Currency.PEN });
      settings.update({ defaultCurrency: Currency.USD });
      expect(settings.defaultCurrency).toBe(Currency.USD);
    });

    it('should update dateFormat', () => {
      const settings = buildUserSettings({ dateFormat: DateFormat.DD_MM_YYYY });
      settings.update({ dateFormat: DateFormat.YYYY_MM_DD });
      expect(settings.dateFormat).toBe(DateFormat.YYYY_MM_DD);
    });

    it('should update startOfWeek', () => {
      const settings = buildUserSettings({ startOfWeek: StartOfWeek.MONDAY });
      settings.update({ startOfWeek: StartOfWeek.SUNDAY });
      expect(settings.startOfWeek).toBe(StartOfWeek.SUNDAY);
    });

    it('should update multiple fields at once', () => {
      const settings = buildUserSettings();
      settings.update({
        language: Language.PT,
        theme: Theme.LIGHT,
        defaultCurrency: Currency.EUR,
      });
      expect(settings.language).toBe(Language.PT);
      expect(settings.theme).toBe(Theme.LIGHT);
      expect(settings.defaultCurrency).toBe(Currency.EUR);
    });

    it('should not change fields not included in partial', () => {
      const settings = buildUserSettings({
        language: Language.ES,
        theme: Theme.DARK,
      });
      settings.update({ language: Language.EN });
      expect(settings.language).toBe(Language.EN);
      expect(settings.theme).toBe(Theme.DARK);
    });

    it('should update updatedAt timestamp', () => {
      const settings = buildUserSettings({
        updatedAt: new Date('2026-01-01'),
      });
      settings.update({ language: Language.EN });
      expect(settings.updatedAt.getTime()).toBeGreaterThan(new Date('2026-01-01').getTime());
    });
  });
});
