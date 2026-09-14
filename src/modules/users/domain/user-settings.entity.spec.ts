import { Currency } from '@common/enums/currency.enum';

import { buildUserSettings } from './__tests__/user-settings.factory';
import { DateFormat } from './enums/date-format.enum';
import { Language } from './enums/language.enum';
import { StartOfWeek } from './enums/start-of-week.enum';
import { Theme } from './enums/theme.enum';
import { MAX_STREAK_SHIELDS, SHIELD_STREAK_THRESHOLD } from './user-settings.entity';

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

    it('should update timezone', () => {
      const settings = buildUserSettings({ timezone: 'UTC' });
      settings.update({ timezone: 'America/Lima' });
      expect(settings.timezone).toBe('America/Lima');
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

describe('UserSettings — streak shields', () => {
  describe('grantShieldIfEarned', () => {
    it('grants nothing below the threshold', () => {
      const s = buildUserSettings({ streakShields: 0, shieldsEarnedMonth: null });

      expect(s.grantShieldIfEarned('2026-09', SHIELD_STREAK_THRESHOLD - 1)).toBe(false);
      expect(s.streakShields).toBe(0);
      expect(s.shieldsEarnedMonth).toBeNull();
    });

    it('grants one on reaching the threshold', () => {
      const s = buildUserSettings({ streakShields: 0, shieldsEarnedMonth: null });

      expect(s.grantShieldIfEarned('2026-09', SHIELD_STREAK_THRESHOLD)).toBe(true);
      expect(s.streakShields).toBe(1);
      expect(s.shieldsEarnedMonth).toBe('2026-09');
    });

    it('grants only once per calendar month', () => {
      const s = buildUserSettings({ streakShields: 0, shieldsEarnedMonth: null });

      s.grantShieldIfEarned('2026-09', 30);
      expect(s.grantShieldIfEarned('2026-09', 40)).toBe(false);
      expect(s.streakShields).toBe(1);
    });

    it('grants again the following month', () => {
      const s = buildUserSettings({ streakShields: 1, shieldsEarnedMonth: '2026-09' });

      expect(s.grantShieldIfEarned('2026-10', 30)).toBe(true);
      expect(s.streakShields).toBe(2);
    });

    // The rule the cap exists for.
    it('LOSES the shield when the stock is already full', () => {
      const s = buildUserSettings({ streakShields: MAX_STREAK_SHIELDS, shieldsEarnedMonth: null });

      expect(s.grantShieldIfEarned('2026-09', 30)).toBe(false);
      expect(s.streakShields).toBe(MAX_STREAK_SHIELDS);
    });

    it('still burns the month when the stock was full — the reward is forfeited, not deferred', () => {
      // Without this, a user could sit at full stock for months, spend one,
      // and immediately collect every month they had "banked". That is the
      // accumulation the cap exists to prevent.
      const s = buildUserSettings({ streakShields: MAX_STREAK_SHIELDS, shieldsEarnedMonth: null });

      s.grantShieldIfEarned('2026-09', 30);
      expect(s.shieldsEarnedMonth).toBe('2026-09');

      s.spendShield();
      expect(s.grantShieldIfEarned('2026-09', 30)).toBe(false);
      expect(s.streakShields).toBe(MAX_STREAK_SHIELDS - 1);
    });
  });

  describe('spendShield', () => {
    it('decrements the stock', () => {
      const s = buildUserSettings({ streakShields: 2 });

      s.spendShield();

      expect(s.streakShields).toBe(1);
    });

    it('refuses to go negative', () => {
      const s = buildUserSettings({ streakShields: 0 });

      expect(() => s.spendShield()).toThrow();
    });
  });
});
