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

    const cappedCount = Math.min(dto.count, habit.targetCount);
    const completed = cappedCount >= habit.targetCount;

    // Upsert: update existing log or create new one
    const existingLog = await this.habitLogRepo.findByHabitIdAndDate(habitId, logDate);

    if (existingLog) {
      existingLog.updateCount(dto.count, habit.targetCount);
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
