import { buildHabit } from '@modules/habits/domain/__tests__/habit.factory';
import { buildHabitLog } from '@modules/habits/domain/__tests__/habit-log.factory';
import { HabitFrequency } from '@modules/habits/domain/enums/habit-frequency.enum';
import { type HabitRepository } from '@modules/habits/domain/habit.repository';
import { type HabitLogRepository } from '@modules/habits/domain/habit-log.repository';
import { buildQuickTask } from '@modules/quick-tasks/domain/__tests__/quick-task.factory';
import { type QuickTaskRepository } from '@modules/quick-tasks/domain/quick-task.repository';
import { type UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { GetRoutinesDashboardUseCase } from './get-routines-dashboard.use-case';

// Freeze "today" so streak math is deterministic across runs.
const FIXED_TODAY = new Date('2026-04-20T15:00:00Z');

describe('GetRoutinesDashboardUseCase', () => {
  let useCase: GetRoutinesDashboardUseCase;
  let habitRepo: jest.Mocked<HabitRepository>;
  let habitLogRepo: jest.Mocked<HabitLogRepository>;
  let quickTaskRepo: jest.Mocked<QuickTaskRepository>;
  let settingsRepo: jest.Mocked<UserSettingsRepository>;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_TODAY);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    habitRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    } as jest.Mocked<HabitRepository>;

    habitLogRepo = {
      findByHabitIdAndDate: jest.fn(),
      findByHabitId: jest.fn(),
      findByUserIdAndDate: jest.fn().mockResolvedValue([]),
      findCompletedByHabitIdSince: jest.fn().mockResolvedValue([]),
      findByHabitIdAndDateRange: jest.fn(),
      save: jest.fn(),
      softDeleteByHabitId: jest.fn(),
    } as jest.Mocked<HabitLogRepository>;

    quickTaskRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn(),
      deleteCompletedBefore: jest.fn(),
      maxPositionByUserId: jest.fn(),
      updatePositions: jest.fn(),
    } as jest.Mocked<QuickTaskRepository>;

    settingsRepo = {
      findByUserId: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
    } as jest.Mocked<UserSettingsRepository>;

    useCase = new GetRoutinesDashboardUseCase(habitRepo, habitLogRepo, quickTaskRepo, settingsRepo);
  });

  it('returns zeroed metrics when the user has no habits or tasks', async () => {
    const result = await useCase.execute('user-1');

    expect(result.topHabitStreaks).toEqual([]);
    expect(result.habitCompletionToday).toEqual({ completedToday: 0, dueToday: 0, rate: 0 });
    expect(result.quickTasksToday).toEqual({ completed: 0, pending: 0, total: 0 });
  });

  it('ranks habit streaks by currentStreak then by longestStreak', async () => {
    const a = buildHabit({ id: 'a', name: 'Agua', frequency: HabitFrequency.DAILY });
    const b = buildHabit({ id: 'b', name: 'Leer', frequency: HabitFrequency.DAILY });
    const c = buildHabit({ id: 'c', name: 'Meditar', frequency: HabitFrequency.DAILY });
    habitRepo.findByUserId.mockResolvedValue([a, b, c]);

    // Give each habit a different completion pattern. `a` gets 3 consecutive
    // recent days (streak=3), `b` gets none, `c` gets 1 recent (streak=1).
    habitLogRepo.findCompletedByHabitIdSince.mockImplementation((habitId) => {
      if (habitId === 'a') {
        return Promise.resolve([
          buildHabitLog({ habitId: 'a', date: '2026-04-20', completed: true }),
          buildHabitLog({ habitId: 'a', date: '2026-04-19', completed: true }),
          buildHabitLog({ habitId: 'a', date: '2026-04-18', completed: true }),
        ]);
      }
      if (habitId === 'c') {
        return Promise.resolve([
          buildHabitLog({ habitId: 'c', date: '2026-04-20', completed: true }),
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await useCase.execute('user-1');

    expect(result.topHabitStreaks.map((s) => s.name)).toEqual(['Agua', 'Meditar', 'Leer']);
    expect(result.topHabitStreaks[0]).toMatchObject({
      habitId: 'a',
      currentStreak: 3,
      frequency: 'DAILY',
    });
    expect(result.topHabitStreaks[2]).toMatchObject({ currentStreak: 0 });
  });

  it('computes daily-habit completion for today', async () => {
    const daily = buildHabit({ id: 'daily', frequency: HabitFrequency.DAILY, targetCount: 1 });
    const weekly = buildHabit({ id: 'weekly', frequency: HabitFrequency.WEEKLY, targetCount: 3 });
    habitRepo.findByUserId.mockResolvedValue([daily, weekly]);

    habitLogRepo.findByUserIdAndDate.mockResolvedValue([
      buildHabitLog({ habitId: 'daily', count: 1, completed: true }),
    ]);

    const result = await useCase.execute('user-1');

    // Only the daily habit counts toward dueToday; it met target → 1/1 = 100%.
    expect(result.habitCompletionToday).toEqual({ completedToday: 1, dueToday: 1, rate: 1 });
  });

  it('splits quick tasks into completed / pending for today', async () => {
    quickTaskRepo.findByUserId.mockResolvedValue([
      buildQuickTask({ id: '1', completed: true, completedAt: new Date() }),
      buildQuickTask({ id: '2', completed: true, completedAt: new Date() }),
      buildQuickTask({ id: '3', completed: false }),
    ]);

    const result = await useCase.execute('user-1');

    expect(result.quickTasksToday).toEqual({ completed: 2, pending: 1, total: 3 });
  });
});
