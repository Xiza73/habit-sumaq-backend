import { Currency } from '@common/enums/currency.enum';

import { buildUserSettings } from '../../domain/__tests__/user-settings.factory';
import { DateFormat } from '../../domain/enums/date-format.enum';
import { Language } from '../../domain/enums/language.enum';
import { StartOfWeek } from '../../domain/enums/start-of-week.enum';
import { Theme } from '../../domain/enums/theme.enum';

import { UserSettingsResponseDto } from './user-settings-response.dto';

describe('UserSettingsResponseDto', () => {
  describe('fromDomain', () => {
    it('should map all fields from domain entity', () => {
      const settings = buildUserSettings({
        id: 'settings-1',
        language: Language.EN,
        theme: Theme.DARK,
        defaultCurrency: Currency.USD,
        dateFormat: DateFormat.MM_DD_YYYY,
        startOfWeek: StartOfWeek.SUNDAY,
        timezone: 'America/Lima',
      });

      const dto = UserSettingsResponseDto.fromDomain(settings);

      expect(dto.id).toBe('settings-1');
      expect(dto.language).toBe(Language.EN);
      expect(dto.theme).toBe(Theme.DARK);
      expect(dto.defaultCurrency).toBe(Currency.USD);
      expect(dto.dateFormat).toBe(DateFormat.MM_DD_YYYY);
      expect(dto.startOfWeek).toBe(StartOfWeek.SUNDAY);
      expect(dto.timezone).toBe('America/Lima');
      expect(dto.createdAt).toBe(settings.createdAt);
      expect(dto.updatedAt).toBe(settings.updatedAt);
    });

    it('maps the nav preferences too', () => {
      const settings = buildUserSettings({
        favoriteKeys: ['debts', 'habits'],
        disabledModules: ['chores', 'reminders'],
      });

      const dto = UserSettingsResponseDto.fromDomain(settings);

      expect(dto.favoriteKeys).toEqual(['debts', 'habits']);
      expect(dto.disabledModules).toEqual(['chores', 'reminders']);
    });

    it('leaves no declared field unmapped', () => {
      // `fromDomain` builds a bare instance and assigns field by field, so a
      // field added to the DTO and forgotten there still type-checks and ships
      // as `undefined`. Asserting on the shape catches that; asserting on a
      // hand-kept list of names only catches what someone remembered to add.
      const dto = UserSettingsResponseDto.fromDomain(buildUserSettings({}));

      const unmapped = Object.entries(dto)
        .filter(([, value]) => value === undefined)
        .map(([field]) => field);

      expect(unmapped).toEqual([]);
    });
  });
});
