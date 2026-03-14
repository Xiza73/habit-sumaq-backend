import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { HabitRepository } from '../../domain/habit.repository';

import type { Habit } from '../../domain/habit.entity';

@Injectable()
export class ArchiveHabitUseCase {
  constructor(private readonly habitRepo: HabitRepository) {}

  async execute(id: string, userId: string): Promise<Habit> {
    const habit = await this.habitRepo.findById(id);
    if (!habit) {
      throw new DomainException('HABIT_NOT_FOUND', 'Hábito no encontrado');
    }
    if (habit.userId !== userId) {
      throw new DomainException('HABIT_BELONGS_TO_OTHER_USER', 'Este hábito no te pertenece');
    }

    if (habit.isArchived) {
      habit.unarchive();
    } else {
      habit.archive();
    }

    return this.habitRepo.save(habit);
  }
}
