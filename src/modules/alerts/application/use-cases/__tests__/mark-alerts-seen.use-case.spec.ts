import { buildUserSettings } from '@modules/users/domain/__tests__/user-settings.factory';

import { MarkAlertsSeenUseCase } from '../mark-alerts-seen.use-case';

import type { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

const USER_ID = 'user-1';

describe('MarkAlertsSeenUseCase', () => {
  it('bumps lastAlertsSeenAt to the provided `now` and persists it', async () => {
    const settings = buildUserSettings({ userId: USER_ID, lastAlertsSeenAt: null });
    const repo: jest.Mocked<UserSettingsRepository> = {
      findByUserId: jest.fn().mockResolvedValue(settings),
      create: jest.fn(),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
    };
    const useCase = new MarkAlertsSeenUseCase(repo);

    const now = new Date('2026-05-19T17:00:00.000Z');
    await useCase.execute(USER_ID, now);

    expect(settings.lastAlertsSeenAt).toEqual(now);
    expect(repo.save).toHaveBeenCalledWith(settings);
  });

  it('creates the settings row first when the user has none yet (mirrors UpdateUserSettings pattern)', async () => {
    const freshSettings = buildUserSettings({ userId: USER_ID, lastAlertsSeenAt: null });
    const repo: jest.Mocked<UserSettingsRepository> = {
      findByUserId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(freshSettings),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
    };
    const useCase = new MarkAlertsSeenUseCase(repo);

    const now = new Date('2026-05-19T17:00:00.000Z');
    await useCase.execute(USER_ID, now);

    expect(repo.create).toHaveBeenCalledWith(USER_ID);
    expect(freshSettings.lastAlertsSeenAt).toEqual(now);
    expect(repo.save).toHaveBeenCalledWith(freshSettings);
  });

  it('does NOT touch updatedAt (so the useUserSettings query stays cached on the web)', async () => {
    const original = new Date('2026-01-01T00:00:00.000Z');
    const settings = buildUserSettings({
      userId: USER_ID,
      lastAlertsSeenAt: null,
      updatedAt: original,
    });
    const repo: jest.Mocked<UserSettingsRepository> = {
      findByUserId: jest.fn().mockResolvedValue(settings),
      create: jest.fn(),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
    };
    const useCase = new MarkAlertsSeenUseCase(repo);

    await useCase.execute(USER_ID, new Date('2026-05-19T17:00:00.000Z'));
    expect(settings.updatedAt).toEqual(original);
  });
});
