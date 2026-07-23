import { DomainException } from '@common/exceptions/domain.exception';
import { buildUserSettings } from '@modules/users/domain/__tests__/user-settings.factory';

import {
  budgetUnloggedId,
  choreOverdueId,
  habitsMiddayId,
  serviceDueTodayId,
  serviceOverdueId,
} from '../../../domain/alert-id';
import { DismissAlertUseCase } from '../dismiss-alert.use-case';

import type { UserAlertDismissalRepository } from '../../../domain/user-alert-dismissal.repository';
import type { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

const USER_ID = 'user-1';
// 17:00 UTC on May 19 = 12:00 Lima. End-of-day Lima = 2026-05-20T05:00 UTC.
const NOW = new Date('2026-05-19T17:00:00.000Z');

function buildDeps(overrides: { timezone?: string } = {}): {
  useCase: DismissAlertUseCase;
  upsert: jest.Mock;
} {
  const upsert = jest.fn().mockImplementation((d) => Promise.resolve(d));
  const dismissalsRepo: jest.Mocked<UserAlertDismissalRepository> = {
    findByUserId: jest.fn(),
    upsert,
  };
  const settings = buildUserSettings({
    userId: USER_ID,
    timezone: overrides.timezone ?? 'America/Lima',
  });
  const userSettingsRepo: jest.Mocked<UserSettingsRepository> = {
    findByUserId: jest.fn().mockResolvedValue(settings),
    create: jest.fn(),
    save: jest.fn(),
  };
  return {
    useCase: new DismissAlertUseCase(dismissalsRepo, userSettingsRepo),
    upsert,
  };
}

describe('DismissAlertUseCase', () => {
  describe('per-day alerts (dismissable)', () => {
    it('writes a dismiss row with expiresAt = midnight in the user TZ', async () => {
      const { useCase, upsert } = buildDeps();
      const id = serviceDueTodayId('abc', '2026-05');
      await useCase.execute(USER_ID, id, NOW);

      expect(upsert).toHaveBeenCalledTimes(1);
      // 2026-05-20T05:00:00.000Z = 2026-05-20T00:00 Lima.
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          alertId: id,
          expiresAt: new Date('2026-05-20T05:00:00.000Z'),
        }),
      );
    });

    it('also accepts habits-midday IDs (per-day)', async () => {
      const { useCase, upsert } = buildDeps();
      await useCase.execute(USER_ID, habitsMiddayId('2026-05-19'), NOW);
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    it('also accepts budget-unlogged IDs (per-day)', async () => {
      const { useCase, upsert } = buildDeps();
      await useCase.execute(USER_ID, budgetUnloggedId('xyz', '2026-05-19'), NOW);
      expect(upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('persistent alerts (rejected)', () => {
    it('throws ALERT_NOT_DISMISSABLE for SERVICE_OVERDUE', async () => {
      const { useCase, upsert } = buildDeps();
      await expect(useCase.execute(USER_ID, serviceOverdueId('abc'), NOW)).rejects.toThrow(
        DomainException,
      );
      expect(upsert).not.toHaveBeenCalled();
    });

    it('throws ALERT_NOT_DISMISSABLE for CHORE_OVERDUE', async () => {
      const { useCase, upsert } = buildDeps();
      await expect(useCase.execute(USER_ID, choreOverdueId('def'), NOW)).rejects.toThrow(
        DomainException,
      );
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe('unknown alert IDs', () => {
    it('throws ALERT_NOT_DISMISSABLE for an unrecognized prefix (defense vs malformed input)', async () => {
      const { useCase, upsert } = buildDeps();
      await expect(useCase.execute(USER_ID, 'totally-not-an-alert:foo', NOW)).rejects.toThrow(
        DomainException,
      );
      expect(upsert).not.toHaveBeenCalled();
    });
  });
});
