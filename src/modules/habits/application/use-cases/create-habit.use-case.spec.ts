import { DomainException } from '@common/exceptions/domain.exception';

import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';
import { buildHabit } from '../../domain/__tests__/habit.factory';

import { CreateHabitUseCase } from './create-habit.use-case';

import type { HabitRepository } from '../../domain/habit.repository';
import type { CreateHabitDto } from '../dto/create-habit.dto';

describe('CreateHabitUseCase', () => {
  let useCase: CreateHabitUseCase;
  let mockRepo: jest.Mocked<HabitRepository>;
  const userId = 'user-1';

  const dto: CreateHabitDto = {
    name: 'Tomar agua',
    frequency: HabitFrequency.DAILY,
    targetCount: 8,
    description: 'Beber 8 vasos',
    color: '#2196F3',
    icon: 'water',
  };

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
      softDelete: jest.fn(),
    } as jest.Mocked<HabitRepository>;

    useCase = new CreateHabitUseCase(mockRepo);
  });

  it('should create a habit successfully', async () => {
    mockRepo.findByUserIdAndName.mockResolvedValue(null);

    const result = await useCase.execute(userId, dto);

    expect(result.name).toBe('Tomar agua');
    expect(result.frequency).toBe(HabitFrequency.DAILY);
    expect(result.targetCount).toBe(8);
    expect(result.description).toBe('Beber 8 vasos');
    expect(result.color).toBe('#2196F3');
    expect(result.icon).toBe('water');
    expect(result.isArchived).toBe(false);
    expect(result.deletedAt).toBeNull();
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should default targetCount to 1 when not provided', async () => {
    mockRepo.findByUserIdAndName.mockResolvedValue(null);

    const minDto: CreateHabitDto = { name: 'Meditar', frequency: HabitFrequency.DAILY };
    const result = await useCase.execute(userId, minDto);

    expect(result.targetCount).toBe(1);
  });

  it('should default optional fields to null', async () => {
    mockRepo.findByUserIdAndName.mockResolvedValue(null);

    const minDto: CreateHabitDto = { name: 'Meditar', frequency: HabitFrequency.DAILY };
    const result = await useCase.execute(userId, minDto);

    expect(result.description).toBeNull();
    expect(result.color).toBeNull();
    expect(result.icon).toBeNull();
  });

  it('should throw HABIT_NAME_TAKEN when name already exists', async () => {
    mockRepo.findByUserIdAndName.mockResolvedValue(buildHabit({ name: dto.name }));

    await expect(useCase.execute(userId, dto)).rejects.toThrow(DomainException);
    await expect(useCase.execute(userId, dto)).rejects.toThrow(
      'Ya existe un hábito llamado "Tomar agua"',
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
