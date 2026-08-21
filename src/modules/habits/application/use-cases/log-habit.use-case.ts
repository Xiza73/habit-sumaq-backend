import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';

import { HabitRepository } from '../../domain/habit.repository';
import { HabitLog } from '../../domain/habit-log.entity';
import { HabitLogRepository } from '../../domain/habit-log.repository';

import { StatsCalculator } from './stats-calculator';

import type { LogHabitDto } from '../dto/log-habit.dto';

@Injectable()
export class LogHabitUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
    @InjectPinoLogger(LogHabitUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    habitId: string,
    userId: string,
    dto: LogHabitDto,
    timezone: string,
  ): Promise<HabitLog> {
    const habit = await this.habitRepo.findById(habitId);
    if (!habit) {
      throw new DomainException('HABIT_NOT_FOUND', 'Hábito no encontrado');
    }
    if (habit.userId !== userId) {
      throw new DomainException('HABIT_BELONGS_TO_OTHER_USER', 'Este hábito no te pertenece');
    }
    if (habit.isArchived) {
      this.logger.warn(
        { event: 'habit.log.archived_habit', habitId, userId },
        'habit.log.archived_habit',
      );
      throw new DomainException(
        'HABIT_ARCHIVED',
        'No se puede registrar un log en un hábito archivado',
      );
    }

    const logDate = dto.date;
    const todayStr = StatsCalculator.toDateString(StatsCalculator.todayIn(timezone));
    if (logDate > todayStr) {
      this.logger.warn(
        { event: 'habit.log.future_date', habitId, userId, date: dto.date },
        'habit.log.future_date',
      );
      throw new DomainException(
        'HABIT_LOG_FUTURE_DATE',
        'No se puede registrar un log para una fecha futura',
      );
    }

    // The target for THIS day. `dto.targetCount` lets a single day ask for
    // more or less without touching the habit's default and without rewriting
    // any other day. Omitted, an existing log keeps the target it was written
    // with — re-logging a past day must not silently re-stamp it with today's
    // default, which is the whole point of snapshotting it.
    const existingLog = await this.habitLogRepo.findByHabitIdAndDate(habitId, logDate);
    const targetCount = dto.targetCount ?? existingLog?.targetCount ?? habit.targetCount;

    const cappedCount = Math.min(dto.count, targetCount);
    const completed = cappedCount >= targetCount;

    // Setting TODAY's target also moves the habit's default, so tomorrow
    // starts from the number the user last chose instead of reverting to the
    // original one and making them redo the edit every day.
    //
    // Only today. Correcting a day you forgot to log is the common case, and
    // it must stay local to that day — otherwise fixing last Tuesday would
    // silently rewrite what every future day starts at. The per-day snapshot
    // on the log keeps the past intact either way.
    if (
      dto.targetCount !== undefined &&
      logDate === todayStr &&
      habit.targetCount !== targetCount
    ) {
      habit.targetCount = targetCount;
      habit.updatedAt = new Date();
      await this.habitRepo.save(habit);
      this.logger.info(
        { event: 'habit.default_target_moved', habitId, userId, targetCount },
        'habit.default_target_moved',
      );
    }

    if (existingLog) {
      existingLog.updateCount(dto.count, targetCount);
      if (dto.note !== undefined) existingLog.note = dto.note ?? null;
      const updated = await this.habitLogRepo.save(existingLog);
      this.logger.info(
        {
          event: 'habit.log.updated',
          habitLogId: updated.id,
          habitId,
          userId,
          date: dto.date,
        },
        'habit.log.updated',
      );
      return updated;
    }

    const now = new Date();
    const log = new HabitLog(
      randomUUID(),
      habitId,
      userId,
      logDate,
      cappedCount,
      completed,
      dto.note ?? null,
      now,
      now,
      targetCount,
    );

    const saved = await this.habitLogRepo.save(log);
    this.logger.info(
      {
        event: 'habit.logged',
        habitLogId: saved.id,
        habitId,
        userId,
        date: dto.date,
      },
      'habit.logged',
    );
    return saved;
  }
}
