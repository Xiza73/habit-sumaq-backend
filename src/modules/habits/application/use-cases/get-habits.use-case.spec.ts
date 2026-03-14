import { buildHabit } from '../../domain/__tests__/habit.factory';

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
    } as jest.Mocked<HabitRepository>;

    habitLogRepo = {
      findByHabitIdAndDate: jest.fn(),
      findByHabitId: jest.fn(),
      findByUserIdAndDate: jest.fn(),
      findCompletedByHabitIdSince: jest.fn(),
      save: jest.fn(),
      softDeleteByHabitId: jest.fn(),
    } as jest.Mocked<HabitLogRepository>;

    useCase = new GetHabitsUseCase(habitRepo, habitLogRepo);
  });

  it('should return habits with stats', async () => {
    habitRepo.findByUserId.mockResolvedValue([
      buildHabit({ userId, name: 'Habit 1' }),
      buildHabit({ userId, name: 'Habit 2' }),
    ]);
    habitLogRepo.findCompletedByHabitIdSince.mockResolvedValue([]);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

    const result = await useCase.execute(userId, {});

    expect(result).toHaveLength(2);
    expect(result[0].currentStreak).toBeDefined();
    expect(result[0].completionRate).toBeDefined();
  });

  it('should return empty array when user has no habits', async () => {
    habitRepo.findByUserId.mockResolvedValue([]);

    const result = await useCase.execute(userId, {});

    expect(result).toHaveLength(0);
  });

  it('should pass includeArchived to repository', async () => {
    habitRepo.findByUserId.mockResolvedValue([]);

    await useCase.execute(userId, { includeArchived: true });

    expect(habitRepo.findByUserId).toHaveBeenCalledWith(userId, true);
  });
});
