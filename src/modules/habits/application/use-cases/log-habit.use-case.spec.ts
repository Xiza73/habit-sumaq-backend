import { Test } from '@nestjs/testing';

import { getLoggerToken } from 'nestjs-pino';

import { buildHabit } from '../../domain/__tests__/habit.factory';
import { buildHabitLog } from '../../domain/__tests__/habit-log.factory';
import { HabitRepository } from '../../domain/habit.repository';
import { HabitLogRepository } from '../../domain/habit-log.repository';

import { LogHabitUseCase } from './log-habit.use-case';
import { StatsCalculator } from './stats-calculator';

import type { LogHabitDto } from '../dto/log-habit.dto';

describe('LogHabitUseCase', () => {
  let useCase: LogHabitUseCase;
  let habitRepo: jest.Mocked<HabitRepository>;
  let habitLogRepo: jest.Mocked<HabitLogRepository>;
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
  const habitId = 'habit-1';
  // Derived the way the use case derives it, for the SAME timezone the tests
  // pass ('UTC'). Using `new Date()` here read the machine's local day, so
  // the two disagreed for anyone in a negative UTC offset once their evening
  // crossed midnight UTC — the target-persistence test passed until 19:00 in
  // Lima and failed after. CI never sees it: runners are UTC, where the two
  // calculations coincide.
  const todayStr = StatsCalculator.toDateString(StatsCalculator.todayIn('UTC'));

  beforeEach(async () => {
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
      save: jest.fn().mockImplementation((l) => Promise.resolve(l)),
      softDeleteByHabitId: jest.fn(),
      findByHabitIdAndDateRange: jest.fn().mockResolvedValue([]),
    };

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
        LogHabitUseCase,
        { provide: HabitRepository, useValue: habitRepo },
        { provide: HabitLogRepository, useValue: habitLogRepo },
        { provide: getLoggerToken(LogHabitUseCase.name), useValue: mockLogger },
      ],
    }).compile();

    useCase = moduleRef.get(LogHabitUseCase);
  });

  it('should create a new log when none exists for the date', async () => {
    const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

    const dto: LogHabitDto = { date: todayStr, count: 5 };
    const result = await useCase.execute(habitId, userId, dto, 'UTC');

    expect(result.count).toBe(5);
    expect(result.completed).toBe(false);
    expect(result.habitId).toBe(habitId);
    expect(result.userId).toBe(userId);
    expect(habitLogRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should set completed to true when count >= targetCount', async () => {
    const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

    const dto: LogHabitDto = { date: todayStr, count: 8 };
    const result = await useCase.execute(habitId, userId, dto, 'UTC');

    expect(result.completed).toBe(true);
  });

  it('should update existing log (upsert)', async () => {
    const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
    const existingLog = buildHabitLog({ habitId, userId, count: 3, completed: false });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(existingLog);

    const dto: LogHabitDto = { date: todayStr, count: 8, note: 'Updated!' };
    const result = await useCase.execute(habitId, userId, dto, 'UTC');

    expect(result.count).toBe(8);
    expect(result.completed).toBe(true);
    expect(result.note).toBe('Updated!');
  });

  it('should preserve existing note on upsert when dto.note is undefined', async () => {
    const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
    const existingLog = buildHabitLog({
      habitId,
      userId,
      count: 3,
      completed: false,
      note: 'Nota original',
    });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(existingLog);

    const dto: LogHabitDto = { date: todayStr, count: 6 };
    const result = await useCase.execute(habitId, userId, dto, 'UTC');

    expect(result.count).toBe(6);
    expect(result.note).toBe('Nota original');
  });

  it('should clear existing note on upsert when dto.note is null', async () => {
    const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
    const existingLog = buildHabitLog({
      habitId,
      userId,
      count: 3,
      completed: false,
      note: 'Nota a borrar',
    });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(existingLog);

    const dto: LogHabitDto = { date: todayStr, count: 6, note: null };
    const result = await useCase.execute(habitId, userId, dto, 'UTC');

    expect(result.note).toBeNull();
  });

  it('should cap count at targetCount when count exceeds it', async () => {
    const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

    const dto: LogHabitDto = { date: todayStr, count: 15 };
    const result = await useCase.execute(habitId, userId, dto, 'UTC');

    expect(result.count).toBe(8);
    expect(result.completed).toBe(true);
  });

  describe("remembering the day's target", () => {
    // Setting today to 4 has to still be 4 tomorrow. Snapshotting the target
    // per day protected the past; on its own it also meant every new day
    // started over from the habit's original default, so the edit had to be
    // repeated daily.
    it("moves the habit default when TODAY's target is set", async () => {
      const habit = buildHabit({ id: habitId, userId, targetCount: 3 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

      await useCase.execute(habitId, userId, { date: todayStr, count: 4, targetCount: 4 }, 'UTC');

      expect(habitRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: habitId, targetCount: 4 }),
      );
    });

    it('leaves the default alone when a PAST day is corrected', async () => {
      // Back-filling a day you forgot is the common case, and it must not
      // move the default forward — that would make fixing Tuesday rewrite
      // what every day from now on starts at.
      const habit = buildHabit({ id: habitId, userId, targetCount: 3 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

      await useCase.execute(
        habitId,
        userId,
        { date: '2020-01-05', count: 5, targetCount: 5 },
        'UTC',
      );

      expect(habitRepo.save).not.toHaveBeenCalled();
    });

    it('leaves the default alone when no target is given', async () => {
      // A plain check-in is not an edit of the objective.
      const habit = buildHabit({ id: habitId, userId, targetCount: 3 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

      await useCase.execute(habitId, userId, { date: todayStr, count: 1 }, 'UTC');

      expect(habitRepo.save).not.toHaveBeenCalled();
    });

    it('does not write when the target given matches the default', async () => {
      const habit = buildHabit({ id: habitId, userId, targetCount: 3 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

      await useCase.execute(habitId, userId, { date: todayStr, count: 1, targetCount: 3 }, 'UTC');

      expect(habitRepo.save).not.toHaveBeenCalled();
    });

    it("still writes the day's own log target, not just the default", async () => {
      const habit = buildHabit({ id: habitId, userId, targetCount: 3 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

      const result = await useCase.execute(
        habitId,
        userId,
        { date: todayStr, count: 4, targetCount: 4 },
        'UTC',
      );

      expect(result.targetCount).toBe(4);
    });
  });

  it('should throw HABIT_NOT_FOUND when habit does not exist', async () => {
    habitRepo.findById.mockResolvedValue(null);

    const dto: LogHabitDto = { date: todayStr, count: 1 };
    await expect(useCase.execute(habitId, userId, dto, 'UTC')).rejects.toThrow(
      'Hábito no encontrado',
    );
  });

  it('should throw HABIT_BELONGS_TO_OTHER_USER when userId mismatch', async () => {
    const habit = buildHabit({ id: habitId, userId: 'other-user' });
    habitRepo.findById.mockResolvedValue(habit);

    const dto: LogHabitDto = { date: todayStr, count: 1 };
    await expect(useCase.execute(habitId, userId, dto, 'UTC')).rejects.toThrow(
      'Este hábito no te pertenece',
    );
  });

  it('should throw HABIT_ARCHIVED when habit is archived', async () => {
    const habit = buildHabit({ id: habitId, userId, isArchived: true });
    habitRepo.findById.mockResolvedValue(habit);

    const dto: LogHabitDto = { date: todayStr, count: 1 };
    await expect(useCase.execute(habitId, userId, dto, 'UTC')).rejects.toThrow(
      'No se puede registrar un log en un hábito archivado',
    );
  });

  it('should throw HABIT_LOG_FUTURE_DATE when date is in the future', async () => {
    const habit = buildHabit({ id: habitId, userId });
    habitRepo.findById.mockResolvedValue(habit);

    const dto: LogHabitDto = { date: '2099-12-31', count: 1 };
    await expect(useCase.execute(habitId, userId, dto, 'UTC')).rejects.toThrow(
      'No se puede registrar un log para una fecha futura',
    );
  });

  it('should allow logging for past dates', async () => {
    const habit = buildHabit({ id: habitId, userId, targetCount: 1 });
    habitRepo.findById.mockResolvedValue(habit);
    habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

    const dto: LogHabitDto = { date: '2026-01-01', count: 1 };
    const result = await useCase.execute(habitId, userId, dto, 'UTC');

    expect(result.completed).toBe(true);
    expect(habitLogRepo.save).toHaveBeenCalledTimes(1);
  });

  describe('structured logging', () => {
    it('should log habit.logged on new log creation', async () => {
      const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

      const dto: LogHabitDto = { date: todayStr, count: 5 };
      const result = await useCase.execute(habitId, userId, dto, 'UTC');

      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'habit.logged',
          habitLogId: result.id,
          habitId,
          userId,
          date: todayStr,
        }),
        'habit.logged',
      );

      const [payload] = mockLogger.info.mock.calls[0] as [Record<string, unknown>, string];
      expect(payload).not.toHaveProperty('note');
      expect(payload).not.toHaveProperty('name');
    });

    it('should log habit.log.updated on upsert (existing log)', async () => {
      const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
      const existingLog = buildHabitLog({ habitId, userId, count: 3, completed: false });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(existingLog);

      const dto: LogHabitDto = { date: todayStr, count: 8, note: 'Updated!' };
      await useCase.execute(habitId, userId, dto, 'UTC');

      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'habit.log.updated',
          habitLogId: existingLog.id,
          habitId,
          userId,
          date: todayStr,
        }),
        'habit.log.updated',
      );

      const [payload] = mockLogger.info.mock.calls[0] as [Record<string, unknown>, string];
      expect(payload).not.toHaveProperty('note');
    });

    it('should log habit.log.archived_habit warn before throwing HABIT_ARCHIVED', async () => {
      const habit = buildHabit({ id: habitId, userId, isArchived: true });
      habitRepo.findById.mockResolvedValue(habit);

      const dto: LogHabitDto = { date: todayStr, count: 1 };
      await expect(useCase.execute(habitId, userId, dto, 'UTC')).rejects.toThrow(
        'No se puede registrar un log en un hábito archivado',
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'habit.log.archived_habit', habitId, userId }),
        'habit.log.archived_habit',
      );
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should log habit.log.future_date warn before throwing HABIT_LOG_FUTURE_DATE', async () => {
      const habit = buildHabit({ id: habitId, userId });
      habitRepo.findById.mockResolvedValue(habit);

      const dto: LogHabitDto = { date: '2099-12-31', count: 1 };
      await expect(useCase.execute(habitId, userId, dto, 'UTC')).rejects.toThrow(
        'No se puede registrar un log para una fecha futura',
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'habit.log.future_date',
          habitId,
          userId,
          date: '2099-12-31',
        }),
        'habit.log.future_date',
      );
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });
  describe('per-day target', () => {
    it('snapshots the habit target onto a brand-new log', async () => {
      const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

      const result = await useCase.execute(habitId, userId, { date: todayStr, count: 3 }, 'UTC');

      expect(result.targetCount).toBe(8);
    });

    it('lets a single day ask for MORE than the habit default', async () => {
      // The reported case: "yesterday it was 3 sets, today 4, both done".
      const habit = buildHabit({ id: habitId, userId, targetCount: 3 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

      const result = await useCase.execute(
        habitId,
        userId,
        { date: todayStr, count: 4, targetCount: 4 },
        'UTC',
      );

      expect(result.targetCount).toBe(4);
      expect(result.count).toBe(4);
      expect(result.completed).toBe(true);
    });

    it('lets a single day ask for LESS', async () => {
      const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

      const result = await useCase.execute(
        habitId,
        userId,
        { date: todayStr, count: 2, targetCount: 2 },
        'UTC',
      );

      expect(result.targetCount).toBe(2);
      expect(result.completed).toBe(true);
    });

    it('KEEPS the existing target when re-logging a past day without one', async () => {
      // Backfilling a forgotten day must not re-stamp it with today's default
      // — that would be the retroactive rewrite all over again, just delayed.
      const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(
        buildHabitLog({ habitId, userId, date: todayStr, count: 1, targetCount: 3 }),
      );

      const result = await useCase.execute(habitId, userId, { date: todayStr, count: 3 }, 'UTC');

      expect(result.targetCount).toBe(3);
      expect(result.completed).toBe(true);
    });

    it('lets an explicit target override the existing one', async () => {
      const habit = buildHabit({ id: habitId, userId, targetCount: 8 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(
        buildHabitLog({ habitId, userId, date: todayStr, count: 1, targetCount: 3 }),
      );

      const result = await useCase.execute(
        habitId,
        userId,
        { date: todayStr, count: 5, targetCount: 5 },
        'UTC',
      );

      expect(result.targetCount).toBe(5);
      expect(result.completed).toBe(true);
    });

    it('caps the count at the day target, which is what makes it recoverable', async () => {
      // completed implies count === targetCount. The migration relies on it to
      // recover historical targets exactly.
      const habit = buildHabit({ id: habitId, userId, targetCount: 3 });
      habitRepo.findById.mockResolvedValue(habit);
      habitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);

      const result = await useCase.execute(habitId, userId, { date: todayStr, count: 99 }, 'UTC');

      expect(result.count).toBe(3);
      expect(result.targetCount).toBe(3);
      expect(result.completed).toBe(true);
    });
  });
});
