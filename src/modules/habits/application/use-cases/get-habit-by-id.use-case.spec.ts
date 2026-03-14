import { DomainException } from '@common/exceptions/domain.exception';

import { buildHabit } from '../../domain/__tests__/habit.factory';
import { buildHabitLog } from '../../domain/__tests__/habit-log.factory';

import { GetHabitByIdUseCase } from './get-habit-by-id.use-case';

import type { HabitRepository } from '../../domain/habit.repository';
import type { HabitLogRepository } from '../../domain/habit-log.repository';

describe('GetHabitByIdUseCase', () => {
  let useCase: GetHabitByIdUseCase;
  let habitRepo: jest.Mocked<HabitRepository>;
  let habitLogRepo: jest.Mocked<HabitLogRepository>;
  const userId = 'user-1';
  const habitId = 'habit-1';

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
      findByHabitIdAndDateRange: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<HabitLogRepository>;

    useCase = new GetHabitByIdUseCase(habitRepo, habitLogRepo);
  });

  it('should return habit with stats', async () => {
    const habit = buildHabit({ id: habitId, userId });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.findCompletedByHabitIdSince.mockResolvedValue([]);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

    const result = await useCase.execute(habitId, userId);

    expect(result.id).toBe(habitId);
    expect(result.currentStreak).toBeDefined();
    expect(result.longestStreak).toBeDefined();
    expect(result.completionRate).toBeDefined();
    expect(result.todayLog).toBeNull();
  });

  it('should include todayLog when it exists', async () => {
    const habit = buildHabit({ id: habitId, userId });
    const todayLog = buildHabitLog({ habitId, count: 3 });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.findCompletedByHabitIdSince.mockResolvedValue([]);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(todayLog);

    const result = await useCase.execute(habitId, userId);

    expect(result.todayLog).toBeDefined();
    expect(result.todayLog!.count).toBe(3);
  });

  it('should throw HABIT_NOT_FOUND when habit does not exist', async () => {
    habitRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(habitId, userId)).rejects.toThrow(DomainException);
  });

  it('should throw HABIT_BELONGS_TO_OTHER_USER when userId mismatch', async () => {
    const habit = buildHabit({ id: habitId, userId: 'other-user' });
    habitRepo.findById.mockResolvedValue(habit);

    await expect(useCase.execute(habitId, userId)).rejects.toThrow('Este hábito no te pertenece');
  });
});
