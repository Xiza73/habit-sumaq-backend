import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Habit } from '../../domain/habit.entity';
import { HabitRepository } from '../../domain/habit.repository';

import type { CreateHabitDto } from '../dto/create-habit.dto';

@Injectable()
export class CreateHabitUseCase {
  private readonly logger = new Logger(CreateHabitUseCase.name);

  constructor(private readonly habitRepo: HabitRepository) {}

  async execute(userId: string, dto: CreateHabitDto): Promise<Habit> {
    const existing = await this.habitRepo.findByUserIdAndName(userId, dto.name);
    if (existing) {
      throw new DomainException('HABIT_NAME_TAKEN', `Ya existe un hábito llamado "${dto.name}"`);
    }

    const now = new Date();
    const habit = new Habit(
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

    const saved = await this.habitRepo.save(habit);
    this.logger.log({ habitId: saved.id, userId }, 'Hábito creado');
    return saved;
  }
}
