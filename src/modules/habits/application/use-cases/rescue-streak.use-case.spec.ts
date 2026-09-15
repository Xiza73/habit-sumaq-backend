import { DomainException } from '@common/exceptions/domain.exception';
import { buildUserSettings } from '@modules/users/domain/__tests__/user-settings.factory';

import { buildHabit } from '../../domain/__tests__/habit.factory';
import { buildHabitLog } from '../../domain/__tests__/habit-log.factory';
import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

import { RescueStreakUseCase } from './rescue-streak.use-case';

import type { HabitRepository } from '../../domain/habit.repository';
import type { HabitLogRepository } from '../../domain/habit-log.repository';
import type { HabitStreakRescueRepository } from '../../domain/habit-streak-rescue.repository';
import type { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

// Frozen clock: 2026-03-13. Yesterday = 03-12, the day before = 03-11.
const FIXED_TODAY = new Date('2026-03-13T15:00:00Z');
const USER_ID = 'user-1';

describe('RescueStreakUseCase', () => {
  let useCase: RescueStreakUseCase;
  let habitRepo: jest.Mocked<HabitRepository>;
  let habitLogRepo: jest.Mocked<HabitLogRepository>;
  let rescueRepo: jest.Mocked<HabitStreakRescueRepository>;
  let settingsRepo: jest.Mocked<UserSettingsRepository>;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_TODAY);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  /** A habit whose only gap is yesterday — the rescuable shape. */
  function gapYesterday() {
    return [
      buildHabitLog({ date: '2026-03-11', completed: true }),
      buildHabitLog({ date: '2026-03-10', completed: true }),
    ];
  }

  beforeEach(() => {
    habitRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest
        .fn()
        .mockResolvedValue(
          buildHabit({ id: 'habit-1', userId: USER_ID, frequency: HabitFrequency.DAILY }),
        ),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    habitLogRepo = {
      findByHabitIdAndDate: jest.fn(),
      findByHabitId: jest.fn(),
      findByUserIdAndDate: jest.fn(),
      findCompletedByHabitId: jest.fn().mockResolvedValue(gapYesterday()),
      findByHabitIdAndDateRange: jest.fn(),
      save: jest.fn(),
      softDeleteByHabitId: jest.fn(),
    };

    rescueRepo = {
      findDatesByHabitId: jest.fn().mockResolvedValue([]),
      findDatesByHabitIds: jest.fn().mockResolvedValue(new Map()),
      create: jest.fn().mockResolvedValue(undefined),
      deleteByHabitIdAndDate: jest.fn().mockResolvedValue(true),
    };

    settingsRepo = {
      findByUserId: jest
        .fn()
        .mockResolvedValue(buildUserSettings({ userId: USER_ID, streakShields: 1 })),
      create: jest.fn(),
      save: jest.fn(),
    };

    useCase = new RescueStreakUseCase(habitRepo, habitLogRepo, rescueRepo, settingsRepo);
  });

  const run = () => useCase.execute('habit-1', USER_ID, 'America/Lima');

  it('records the rescue and spends a shield', async () => {
    const result = await run();

    expect(result).toEqual({ rescuedDate: '2026-03-12' });
    expect(rescueRepo.create).toHaveBeenCalledWith('habit-1', USER_ID, '2026-03-12');
    const saved = settingsRepo.save.mock.calls[0][0];
    expect(saved.streakShields).toBe(0);
  });

  // The write order is a deliberate call, not an accident of how the code was
  // typed. These two repositories belong to different modules, so a shared
  // transaction would mean reaching past the repository abstractions. Instead
  // the rescue lands FIRST: if the second write fails the user keeps a shield
  // they already used, which is mildly generous. The reverse would take a
  // shield and give nothing back.
  it('records the rescue BEFORE spending the shield', async () => {
    const order: string[] = [];
    rescueRepo.create.mockImplementation(() => {
      order.push('rescue');
      return Promise.resolve(undefined as never);
    });
    settingsRepo.save.mockImplementation((s) => {
      order.push('shield');
      return Promise.resolve(s);
    });

    await run();

    expect(order).toEqual(['rescue', 'shield']);
  });

  it('never writes anything when there is no shield', async () => {
    settingsRepo.findByUserId.mockResolvedValue(
      buildUserSettings({ userId: USER_ID, streakShields: 0 }),
    );

    await expect(run()).rejects.toThrow(DomainException);
    expect(rescueRepo.create).not.toHaveBeenCalled();
    expect(settingsRepo.save).not.toHaveBeenCalled();
  });

  it('never writes anything when no period is rescuable', async () => {
    // Yesterday was completed — there is no gap to bridge.
    habitLogRepo.findCompletedByHabitId.mockResolvedValue([
      buildHabitLog({ date: '2026-03-12', completed: true }),
      buildHabitLog({ date: '2026-03-11', completed: true }),
    ]);

    await expect(run()).rejects.toThrow(DomainException);
    expect(rescueRepo.create).not.toHaveBeenCalled();
    expect(settingsRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a habit that does not exist', async () => {
    habitRepo.findById.mockResolvedValue(null);
    await expect(run()).rejects.toThrow(DomainException);
  });

  it("rejects another user's habit", async () => {
    habitRepo.findById.mockResolvedValue(
      buildHabit({ id: 'habit-1', userId: 'someone-else', frequency: HabitFrequency.DAILY }),
    );
    await expect(run()).rejects.toThrow(DomainException);
    expect(rescueRepo.create).not.toHaveBeenCalled();
  });

  it('rejects an archived habit', async () => {
    habitRepo.findById.mockResolvedValue(
      buildHabit({
        id: 'habit-1',
        userId: USER_ID,
        frequency: HabitFrequency.DAILY,
        isArchived: true,
      }),
    );
    await expect(run()).rejects.toThrow(DomainException);
    expect(rescueRepo.create).not.toHaveBeenCalled();
  });

  it('does not offer a period that was already rescued', async () => {
    rescueRepo.findDatesByHabitId.mockResolvedValue(['2026-03-12']);

    await expect(run()).rejects.toThrow(DomainException);
    expect(rescueRepo.create).not.toHaveBeenCalled();
  });
});
