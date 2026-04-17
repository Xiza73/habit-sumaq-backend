import { DomainException } from '@common/exceptions/domain.exception';

import { buildHabit } from '../../domain/__tests__/habit.factory';
import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

import { UpdateHabitUseCase } from './update-habit.use-case';

import type { HabitRepository } from '../../domain/habit.repository';
import type { UpdateHabitDto } from '../dto/update-habit.dto';

describe('UpdateHabitUseCase', () => {
  let useCase: UpdateHabitUseCase;
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

    useCase = new UpdateHabitUseCase(mockRepo);
  });

  it('should update habit name', async () => {
    const habit = buildHabit({ id: habitId, userId, name: 'Old name' });
    mockRepo.findById.mockResolvedValue(habit);
    mockRepo.findByUserIdAndName.mockResolvedValue(null);

    const dto: UpdateHabitDto = { name: 'New name' };
    const result = await useCase.execute(habitId, userId, dto);

    expect(result.name).toBe('New name');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should update targetCount and frequency', async () => {
    const habit = buildHabit({ id: habitId, userId });
    mockRepo.findById.mockResolvedValue(habit);

    const dto: UpdateHabitDto = { targetCount: 10, frequency: HabitFrequency.WEEKLY };
    const result = await useCase.execute(habitId, userId, dto);

    expect(result.targetCount).toBe(10);
    expect(result.frequency).toBe(HabitFrequency.WEEKLY);
  });

  it('should skip duplicate check when name unchanged', async () => {
    const habit = buildHabit({ id: habitId, userId, name: 'Same' });
    mockRepo.findById.mockResolvedValue(habit);

    const dto: UpdateHabitDto = { name: 'Same' };
    await useCase.execute(habitId, userId, dto);

    expect(mockRepo.findByUserIdAndName).not.toHaveBeenCalled();
  });

  it('should throw HABIT_NOT_FOUND when habit does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(habitId, userId, { name: 'X' })).rejects.toThrow(DomainException);
    await expect(useCase.execute(habitId, userId, { name: 'X' })).rejects.toThrow(
      'Hábito no encontrado',
    );
  });

  it('should throw HABIT_BELONGS_TO_OTHER_USER when userId mismatch', async () => {
    const habit = buildHabit({ id: habitId, userId: 'other-user' });
    mockRepo.findById.mockResolvedValue(habit);

    await expect(useCase.execute(habitId, userId, { name: 'X' })).rejects.toThrow(
      'Este hábito no te pertenece',
    );
  });

  it('should throw HABIT_NAME_TAKEN when new name already exists', async () => {
    const habit = buildHabit({ id: habitId, userId, name: 'Old' });
    mockRepo.findById.mockResolvedValue(habit);
    mockRepo.findByUserIdAndName.mockResolvedValue(buildHabit({ name: 'Taken' }));

    await expect(useCase.execute(habitId, userId, { name: 'Taken' })).rejects.toThrow(
      DomainException,
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate INVALID_TARGET_COUNT from domain when targetCount < 1', async () => {
    // @Min(1) on UpdateHabitDto catches this at the HTTP boundary (400).
    // This test covers the defense-in-depth path: if the use case is
    // called programmatically (from a script, job, or another module),
    // Habit.updateProfile invokes assertTargetCount and throws, and the
    // use case must propagate the error without swallowing it.
    const habit = buildHabit({ id: habitId, userId, targetCount: 5 });
    mockRepo.findById.mockResolvedValue(habit);
    mockRepo.findByUserIdAndName.mockResolvedValue(null);

    await expect(useCase.execute(habitId, userId, { targetCount: 0 })).rejects.toThrow(
      DomainException,
    );
    await expect(useCase.execute(habitId, userId, { targetCount: 0 })).rejects.toMatchObject({
      code: 'INVALID_TARGET_COUNT',
    });
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(habit.targetCount).toBe(5);
  });
});
