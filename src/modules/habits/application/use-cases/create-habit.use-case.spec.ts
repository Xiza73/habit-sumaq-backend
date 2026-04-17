import { Test } from '@nestjs/testing';

import { getLoggerToken } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';

import { buildHabit } from '../../domain/__tests__/habit.factory';
import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';
import { HabitRepository } from '../../domain/habit.repository';

import { CreateHabitUseCase } from './create-habit.use-case';

import type { CreateHabitDto } from '../dto/create-habit.dto';

describe('CreateHabitUseCase', () => {
  let useCase: CreateHabitUseCase;
  let mockRepo: jest.Mocked<HabitRepository>;
  let mockLogger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
    trace: jest.Mock;
    fatal: jest.Mock;
    setContext: jest.Mock;
  };
  const userId = 'user-1';

  const dto: CreateHabitDto = {
    name: 'Tomar agua',
    frequency: HabitFrequency.DAILY,
    targetCount: 8,
    description: 'Beber 8 vasos',
    color: '#2196F3',
    icon: 'water',
  };

  beforeEach(async () => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
      softDelete: jest.fn(),
    } as jest.Mocked<HabitRepository>;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      setContext: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateHabitUseCase,
        { provide: HabitRepository, useValue: mockRepo },
        { provide: getLoggerToken(CreateHabitUseCase.name), useValue: mockLogger },
      ],
    }).compile();

    useCase = moduleRef.get(CreateHabitUseCase);
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

  describe('structured logging', () => {
    it('should log habit.created with non-PII fields on success', async () => {
      mockRepo.findByUserIdAndName.mockResolvedValue(null);

      const result = await useCase.execute(userId, dto);

      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'habit.created', habitId: result.id, userId }),
        'habit.created',
      );

      const [payload] = mockLogger.info.mock.calls[0] as [Record<string, unknown>, string];
      expect(payload).not.toHaveProperty('name');
      expect(payload).not.toHaveProperty('description');
      expect(payload).not.toHaveProperty('email');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should log habit.create.conflict on duplicate name', async () => {
      mockRepo.findByUserIdAndName.mockResolvedValue(buildHabit({ name: dto.name }));

      await expect(useCase.execute(userId, dto)).rejects.toThrow(DomainException);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'habit.create.conflict', userId }),
        'habit.create.conflict',
      );

      const [payload] = mockLogger.warn.mock.calls[0] as [Record<string, unknown>, string];
      expect(payload).not.toHaveProperty('habitName');
      expect(payload).not.toHaveProperty('name');
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should log habit.create.invalid_target when domain rejects targetCount', async () => {
      mockRepo.findByUserIdAndName.mockResolvedValue(null);

      const invalidDto: CreateHabitDto = { ...dto, targetCount: 0 };

      await expect(useCase.execute(userId, invalidDto)).rejects.toThrow(DomainException);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'habit.create.invalid_target',
          userId,
          targetCount: 0,
        }),
        'habit.create.invalid_target',
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
