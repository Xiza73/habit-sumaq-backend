import { Currency } from '@modules/accounts/domain/enums/currency.enum';

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
      });

      const dto = UserSettingsResponseDto.fromDomain(settings);

      expect(dto.id).toBe('settings-1');
      expect(dto.language).toBe(Language.EN);
      expect(dto.theme).toBe(Theme.DARK);
      expect(dto.defaultCurrency).toBe(Currency.USD);
      expect(dto.dateFormat).toBe(DateFormat.MM_DD_YYYY);
      expect(dto.startOfWeek).toBe(StartOfWeek.SUNDAY);
      expect(dto.createdAt).toBe(settings.createdAt);
      expect(dto.updatedAt).toBe(settings.updatedAt);
    });
  });
});
