import { buildHabit } from '../../domain/__tests__/habit.factory';
import { buildHabitLog } from '../../domain/__tests__/habit-log.factory';

import { GetHabitsUseCase } from './get-habits.use-case';

import type { HabitRepository } from '../../domain/habit.repository';
import type { HabitLogRepository } from '../../domain/habit-log.repository';

describe('GetHabitsUseCase', () => {
  let useCase: GetHabitsUseCase;
  let habitRepo: jest.Mocked<HabitRepository>;
  let habitLogRepo: jest.Mocked<HabitLogRepository>;
  const userId = 'user-1';

  beforeEach(() => {
    habitRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    habitLogRepo = {
      findByHabitIdAndDate: jest.fn(),
      findByHabitId: jest.fn(),
      findByUserIdAndDate: jest.fn(),
      findCompletedByHabitId: jest.fn(),
      save: jest.fn(),
      softDeleteByHabitId: jest.fn(),
      findByHabitIdAndDateRange: jest.fn().mockResolvedValue([]),
    };

    const rescueRepo = {
      findDatesByHabitId: jest.fn().mockResolvedValue([]),
      findDatesByHabitIds: jest.fn().mockResolvedValue(new Map()),
      create: jest.fn(),
    };

    useCase = new GetHabitsUseCase(habitRepo, habitLogRepo, rescueRepo);
  });

  it('should return habits with stats', async () => {
    habitRepo.findByUserId.mockResolvedValue([
      buildHabit({ userId, name: 'Habit 1' }),
      buildHabit({ userId, name: 'Habit 2' }),
    ]);
    habitLogRepo.findCompletedByHabitId.mockResolvedValue([]);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

    const result = await useCase.execute(userId, {}, 'UTC');

    expect(result).toHaveLength(2);
    expect(result[0].currentStreak).toBeDefined();
    expect(result[0].completionRate).toBeDefined();
  });

  it('should return empty array when user has no habits', async () => {
    habitRepo.findByUserId.mockResolvedValue([]);

    const result = await useCase.execute(userId, {}, 'UTC');

    expect(result).toHaveLength(0);
  });

  it('should pass includeArchived to repository', async () => {
    habitRepo.findByUserId.mockResolvedValue([]);

    await useCase.execute(userId, { includeArchived: true }, 'UTC');

    expect(habitRepo.findByUserId).toHaveBeenCalledWith(userId, true);
  });
});

describe('GetHabitsUseCase — rescuableDate', () => {
  // Frozen clock: 2026-03-13. Yesterday = 03-12, the day before = 03-11.
  const FIXED_TODAY = new Date('2026-03-13T15:00:00Z');
  const userId = 'user-1';

  let useCase: GetHabitsUseCase;
  let habitRepo: jest.Mocked<HabitRepository>;
  let habitLogRepo: jest.Mocked<HabitLogRepository>;
  let rescueRepo: {
    findDatesByHabitId: jest.Mock;
    findDatesByHabitIds: jest.Mock;
    create: jest.Mock;
  };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_TODAY);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    habitRepo = {
      findByUserId: jest.fn().mockResolvedValue([buildHabit({ id: 'h1', userId })]),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    habitLogRepo = {
      findByHabitIdAndDate: jest.fn(),
      findByHabitId: jest.fn(),
      findByUserIdAndDate: jest.fn(),
      findCompletedByHabitId: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      softDeleteByHabitId: jest.fn(),
      findByHabitIdAndDateRange: jest.fn().mockResolvedValue([]),
    };
    rescueRepo = {
      findDatesByHabitId: jest.fn().mockResolvedValue([]),
      findDatesByHabitIds: jest.fn().mockResolvedValue(new Map()),
      create: jest.fn(),
    };
    useCase = new GetHabitsUseCase(habitRepo, habitLogRepo, rescueRepo);
  });

  it('exposes the rescuable period when there is one', async () => {
    // Gap yesterday, anchored by the day before → yesterday is rescuable.
    habitLogRepo.findCompletedByHabitId.mockResolvedValue([
      buildHabitLog({ habitId: 'h1', date: '2026-03-11', completed: true }),
      buildHabitLog({ habitId: 'h1', date: '2026-03-10', completed: true }),
    ]);

    const [habit] = await useCase.execute(userId, {}, 'UTC');

    expect(habit.rescuableDate).toBe('2026-03-12');
  });

  it('exposes null when nothing is rescuable', async () => {
    habitLogRepo.findCompletedByHabitId.mockResolvedValue([
      buildHabitLog({ habitId: 'h1', date: '2026-03-12', completed: true }),
      buildHabitLog({ habitId: 'h1', date: '2026-03-11', completed: true }),
    ]);

    const [habit] = await useCase.execute(userId, {}, 'UTC');

    expect(habit.rescuableDate).toBeNull();
  });

  it('costs no extra query — reuses the logs and rescues the stats already load', async () => {
    await useCase.execute(userId, {}, 'UTC');

    expect(habitLogRepo.findCompletedByHabitId).toHaveBeenCalledTimes(1);
    expect(rescueRepo.findDatesByHabitId).toHaveBeenCalledTimes(1);
  });
});
