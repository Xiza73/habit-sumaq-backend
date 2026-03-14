import { buildHabit } from '../../domain/__tests__/habit.factory';

import { GetDailySummaryUseCase } from './get-daily-summary.use-case';

import type { HabitRepository } from '../../domain/habit.repository';
import type { HabitLogRepository } from '../../domain/habit-log.repository';

describe('GetDailySummaryUseCase', () => {
  let useCase: GetDailySummaryUseCase;
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
      findByHabitIdAndDateRange: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<HabitLogRepository>;

    useCase = new GetDailySummaryUseCase(habitRepo, habitLogRepo);
  });

  it('should return only active habits with stats', async () => {
    habitRepo.findByUserId.mockResolvedValue([buildHabit({ userId })]);
    habitLogRepo.findCompletedByHabitIdSince.mockResolvedValue([]);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

    const result = await useCase.execute(userId);

    expect(result).toHaveLength(1);
    expect(result[0].currentStreak).toBeDefined();
    expect(habitRepo.findByUserId).toHaveBeenCalledWith(userId, false);
  });

  it('should return empty array when no active habits', async () => {
    habitRepo.findByUserId.mockResolvedValue([]);

    const result = await useCase.execute(userId);

    expect(result).toHaveLength(0);
  });
});
