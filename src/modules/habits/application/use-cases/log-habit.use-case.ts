import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { HabitRepository } from '../../domain/habit.repository';
import { HabitLog } from '../../domain/habit-log.entity';
import { HabitLogRepository } from '../../domain/habit-log.repository';

import { StatsCalculator } from './stats-calculator';

import type { LogHabitDto } from '../dto/log-habit.dto';

@Injectable()
export class LogHabitUseCase {
  private readonly logger = new Logger(LogHabitUseCase.name);

  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
  ) {}

  async execute(habitId: string, userId: string, dto: LogHabitDto): Promise<HabitLog> {
    const habit = await this.habitRepo.findById(habitId);
    if (!habit) {
      throw new DomainException('HABIT_NOT_FOUND', 'Hábito no encontrado');
    }
    if (habit.userId !== userId) {
      throw new DomainException('HABIT_BELONGS_TO_OTHER_USER', 'Este hábito no te pertenece');
    }
    if (habit.isArchived) {
      throw new DomainException(
        'HABIT_ARCHIVED',
        'No se puede registrar un log en un hábito archivado',
      );
    }

    const logDate = dto.date;
    const todayStr = StatsCalculator.toDateString(new Date());
    if (logDate > todayStr) {
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
      return this.habitLogRepo.save(existingLog);
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
    this.logger.log(
      { habitLogId: saved.id, habitId, userId, date: dto.date },
      'Habit log registrado',
    );
    return saved;
  }
}
