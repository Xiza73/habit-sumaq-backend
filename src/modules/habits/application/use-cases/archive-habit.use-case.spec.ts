import { DomainException } from '@common/exceptions/domain.exception';

import { buildHabit } from '../../domain/__tests__/habit.factory';

import { ArchiveHabitUseCase } from './archive-habit.use-case';

import type { HabitRepository } from '../../domain/habit.repository';

describe('ArchiveHabitUseCase', () => {
  let useCase: ArchiveHabitUseCase;
  let mockRepo: jest.Mocked<HabitRepository>;
  const userId = 'user-1';
  const habitId = 'habit-1';

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
      softDelete: jest.fn(),
    } as jest.Mocked<HabitRepository>;

    useCase = new ArchiveHabitUseCase(mockRepo);
  });

  it('should archive an active habit', async () => {
    const habit = buildHabit({ id: habitId, userId, isArchived: false });
    mockRepo.findById.mockResolvedValue(habit);

    const result = await useCase.execute(habitId, userId);

    expect(result.isArchived).toBe(true);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should unarchive an archived habit', async () => {
    const habit = buildHabit({ id: habitId, userId, isArchived: true });
    mockRepo.findById.mockResolvedValue(habit);

    const result = await useCase.execute(habitId, userId);

    expect(result.isArchived).toBe(false);
  });

  it('should throw HABIT_NOT_FOUND when habit does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(habitId, userId)).rejects.toThrow(DomainException);
  });

  it('should throw HABIT_BELONGS_TO_OTHER_USER when userId mismatch', async () => {
    const habit = buildHabit({ id: habitId, userId: 'other-user' });
    mockRepo.findById.mockResolvedValue(habit);

    await expect(useCase.execute(habitId, userId)).rejects.toThrow(
      'Este hábito no te pertenece',
    );
  });
});
