import { DomainException } from '@common/exceptions/domain.exception';

import { buildHabit } from '../../domain/__tests__/habit.factory';

import { DeleteHabitUseCase } from './delete-habit.use-case';

import type { HabitLogRepository } from '../../domain/habit-log.repository';
import type { HabitRepository } from '../../domain/habit.repository';

describe('DeleteHabitUseCase', () => {
  let useCase: DeleteHabitUseCase;
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
    } as jest.Mocked<HabitLogRepository>;

    useCase = new DeleteHabitUseCase(habitRepo, habitLogRepo);
  });

  it('should delete logs then soft-delete the habit', async () => {
    const habit = buildHabit({ id: habitId, userId });
    habitRepo.findById.mockResolvedValue(habit);

    await useCase.execute(habitId, userId);

    expect(habitLogRepo.softDeleteByHabitId).toHaveBeenCalledWith(habitId);
    expect(habitRepo.softDelete).toHaveBeenCalledWith(habitId);
  });

  it('should delete logs before the habit', async () => {
    const callOrder: string[] = [];
    const habit = buildHabit({ id: habitId, userId });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.softDeleteByHabitId.mockImplementation(async () => {
      callOrder.push('logs');
    });
    habitRepo.softDelete.mockImplementation(async () => {
      callOrder.push('habit');
    });

    await useCase.execute(habitId, userId);

    expect(callOrder).toEqual(['logs', 'habit']);
  });

  it('should throw HABIT_NOT_FOUND when habit does not exist', async () => {
    habitRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(habitId, userId)).rejects.toThrow(DomainException);
  });

  it('should throw HABIT_BELONGS_TO_OTHER_USER when userId mismatch', async () => {
    const habit = buildHabit({ id: habitId, userId: 'other-user' });
    habitRepo.findById.mockResolvedValue(habit);

    await expect(useCase.execute(habitId, userId)).rejects.toThrow(
      'Este hábito no te pertenece',
    );
    expect(habitLogRepo.softDeleteByHabitId).not.toHaveBeenCalled();
    expect(habitRepo.softDelete).not.toHaveBeenCalled();
  });
});
