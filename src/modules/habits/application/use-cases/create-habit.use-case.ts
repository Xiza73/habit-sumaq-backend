import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';

import { Habit } from '../../domain/habit.entity';
import { HabitRepository } from '../../domain/habit.repository';

import type { CreateHabitDto } from '../dto/create-habit.dto';

@Injectable()
export class CreateHabitUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    @InjectPinoLogger(CreateHabitUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(userId: string, dto: CreateHabitDto): Promise<Habit> {
    const existing = await this.habitRepo.findByUserIdAndName(userId, dto.name);
    if (existing) {
      this.logger.warn({ event: 'habit.create.conflict', userId }, 'habit.create.conflict');
      throw new DomainException('HABIT_NAME_TAKEN', `Ya existe un hábito llamado "${dto.name}"`);
    }

    const now = new Date();
    let habit: Habit;
    try {
      habit = new Habit(
        randomUUID(),
        userId,
        dto.name,
        dto.description ?? null,
        dto.frequency,
        dto.targetCount ?? 1,
        dto.color ?? null,
        dto.icon ?? null,
        false,
        now,
        now,
        null,
      );
    } catch (err) {
      if (err instanceof DomainException && err.code === 'INVALID_TARGET_COUNT') {
        this.logger.warn(
          {
            event: 'habit.create.invalid_target',
            userId,
            targetCount: dto.targetCount,
          },
          'habit.create.invalid_target',
        );
      }
      throw err;
    }

    const saved = await this.habitRepo.save(habit);
    this.logger.info({ event: 'habit.created', habitId: saved.id, userId }, 'habit.created');
    return saved;
  }
}
