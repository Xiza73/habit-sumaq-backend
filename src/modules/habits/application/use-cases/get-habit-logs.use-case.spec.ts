import { DomainException } from '@common/exceptions/domain.exception';

import { buildHabit } from '../../domain/__tests__/habit.factory';
import { buildHabitLog } from '../../domain/__tests__/habit-log.factory';

import { GetHabitLogsUseCase } from './get-habit-logs.use-case';

import type { HabitRepository } from '../../domain/habit.repository';
import type { HabitLogRepository } from '../../domain/habit-log.repository';

describe('GetHabitLogsUseCase', () => {
  let useCase: GetHabitLogsUseCase;
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

    useCase = new GetHabitLogsUseCase(habitRepo, habitLogRepo);
  });

  it('should return paginated logs', async () => {
    const habit = buildHabit({ id: habitId, userId });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.findByHabitId.mockResolvedValue({
      data: [buildHabitLog(), buildHabitLog()],
      total: 5,
    });

    const result = await useCase.execute(habitId, userId, { page: 1, limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(5);
  });

  it('should pass date filters to repository', async () => {
    const habit = buildHabit({ id: habitId, userId });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.findByHabitId.mockResolvedValue({ data: [], total: 0 });

    await useCase.execute(habitId, userId, {
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
      page: 1,
      limit: 20,
    });

    expect(habitLogRepo.findByHabitId).toHaveBeenCalledWith(
      habitId,
      '2026-03-01',
      '2026-03-31',
      1,
      20,
    );
  });

  it('should throw HABIT_NOT_FOUND when habit does not exist', async () => {
    habitRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(habitId, userId, { page: 1, limit: 20 })).rejects.toThrow(
      DomainException,
    );
  });

  it('should throw HABIT_BELONGS_TO_OTHER_USER when userId mismatch', async () => {
    const habit = buildHabit({ id: habitId, userId: 'other-user' });
    habitRepo.findById.mockResolvedValue(habit);

    await expect(useCase.execute(habitId, userId, { page: 1, limit: 20 })).rejects.toThrow(
      'Este hábito no te pertenece',
    );
  });
});
