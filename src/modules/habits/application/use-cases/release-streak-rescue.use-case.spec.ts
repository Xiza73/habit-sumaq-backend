import { DomainException } from '@common/exceptions/domain.exception';
import { buildUserSettings } from '@modules/users/domain/__tests__/user-settings.factory';

import { buildHabit } from '../../domain/__tests__/habit.factory';
import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

import { ReleaseStreakRescueUseCase } from './release-streak-rescue.use-case';

import type { HabitRepository } from '../../domain/habit.repository';
import type { HabitStreakRescueRepository } from '../../domain/habit-streak-rescue.repository';
import type { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

const USER_ID = 'user-1';

describe('ReleaseStreakRescueUseCase', () => {
  let useCase: ReleaseStreakRescueUseCase;
  let habitRepo: jest.Mocked<HabitRepository>;
  let rescueRepo: jest.Mocked<HabitStreakRescueRepository>;
  let settingsRepo: jest.Mocked<UserSettingsRepository>;

  function setup(
    frequency: HabitFrequency = HabitFrequency.DAILY,
    rescued: string[] = ['2026-03-12'],
    shields = 0,
  ) {
    habitRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest
        .fn()
        .mockResolvedValue(buildHabit({ id: 'habit-1', userId: USER_ID, frequency })),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    rescueRepo = {
      findDatesByHabitId: jest.fn().mockResolvedValue(rescued),
      findDatesByHabitIds: jest.fn(),
      create: jest.fn(),
      deleteByHabitIdAndDate: jest.fn().mockResolvedValue(true),
    };

    settingsRepo = {
      findByUserId: jest
        .fn()
        .mockResolvedValue(buildUserSettings({ userId: USER_ID, streakShields: shields })),
      create: jest.fn(),
      save: jest.fn(),
    };

    useCase = new ReleaseStreakRescueUseCase(habitRepo, rescueRepo, settingsRepo);
  }

  beforeEach(() => setup());

  it('deletes the rescue and gives the shield back', async () => {
    const result = await useCase.execute('habit-1', USER_ID, '2026-03-12');

    expect(result).toEqual({ releasedDate: '2026-03-12', shieldReturned: true });
    expect(rescueRepo.deleteByHabitIdAndDate).toHaveBeenCalledWith('habit-1', '2026-03-12');
    expect(settingsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ streakShields: 1 }));
  });

  it('refunds BEFORE deleting, so a half-failure never leaves the user empty-handed', async () => {
    // Same reasoning as the write order in RescueStreakUseCase, mirrored.
    // Deleting first and then failing to refund is the one outcome that takes
    // a shield and gives nothing back.
    const order: string[] = [];
    settingsRepo.save.mockImplementation(() => {
      order.push('refund');
      return Promise.resolve(undefined as never);
    });
    rescueRepo.deleteByHabitIdAndDate.mockImplementation(() => {
      order.push('delete');
      return Promise.resolve(true);
    });

    await useCase.execute('habit-1', USER_ID, '2026-03-12');

    expect(order).toEqual(['refund', 'delete']);
  });

  it('reports shieldReturned false when the stock is already full', async () => {
    setup(HabitFrequency.DAILY, ['2026-03-12'], 2);

    const result = await useCase.execute('habit-1', USER_ID, '2026-03-12');

    // The rescue still goes: the user asked to log that day, and refusing
    // would leave them stuck on it. They are told the shield did not return.
    expect(result).toEqual({ releasedDate: '2026-03-12', shieldReturned: false });
    expect(rescueRepo.deleteByHabitIdAndDate).toHaveBeenCalled();
  });

  it('resolves any day of a rescued week back to the stored Monday', async () => {
    setup(HabitFrequency.WEEKLY, ['2026-03-09']);

    const result = await useCase.execute('habit-1', USER_ID, '2026-03-12');

    // Deleting by the raw input would miss the row on six days out of seven.
    expect(result.releasedDate).toBe('2026-03-09');
    expect(rescueRepo.deleteByHabitIdAndDate).toHaveBeenCalledWith('habit-1', '2026-03-09');
  });

  it('rejects a period that is not rescued', async () => {
    await expect(useCase.execute('habit-1', USER_ID, '2026-03-11')).rejects.toThrow(
      DomainException,
    );
    expect(rescueRepo.deleteByHabitIdAndDate).not.toHaveBeenCalled();
    expect(settingsRepo.save).not.toHaveBeenCalled();
  });

  it('refuses to touch another user’s habit', async () => {
    habitRepo.findById.mockResolvedValue(buildHabit({ id: 'habit-1', userId: 'someone-else' }));

    await expect(useCase.execute('habit-1', USER_ID, '2026-03-12')).rejects.toThrow(
      DomainException,
    );
    expect(rescueRepo.deleteByHabitIdAndDate).not.toHaveBeenCalled();
  });

  it('releases without a refund when the user has no settings row', async () => {
    // Unreachable through the app — spending a shield requires settings — but
    // inventing an error here would strand the user on a day they cannot log.
    settingsRepo.findByUserId.mockResolvedValue(null);

    const result = await useCase.execute('habit-1', USER_ID, '2026-03-12');

    expect(result).toEqual({ releasedDate: '2026-03-12', shieldReturned: false });
    expect(rescueRepo.deleteByHabitIdAndDate).toHaveBeenCalledWith('habit-1', '2026-03-12');
    expect(settingsRepo.save).not.toHaveBeenCalled();
  });
});
