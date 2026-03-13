import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { HabitRepository } from '../../domain/habit.repository';

import type { Habit } from '../../domain/habit.entity';
import type { UpdateHabitDto } from '../dto/update-habit.dto';

@Injectable()
export class UpdateHabitUseCase {
  constructor(private readonly habitRepo: HabitRepository) {}

  async execute(id: string, userId: string, dto: UpdateHabitDto): Promise<Habit> {
    const habit = await this.habitRepo.findById(id);
    if (!habit) {
      throw new DomainException('HABIT_NOT_FOUND', 'Hábito no encontrado');
    }
    if (habit.userId !== userId) {
      throw new DomainException('HABIT_BELONGS_TO_OTHER_USER', 'Este hábito no te pertenece');
    }

    const newName = dto.name ?? habit.name;

    if (dto.name && dto.name !== habit.name) {
      const duplicate = await this.habitRepo.findByUserIdAndName(userId, dto.name);
      if (duplicate) {
        throw new DomainException('HABIT_NAME_TAKEN', `Ya existe un hábito llamado "${dto.name}"`);
      }
    }

    habit.updateProfile(
      newName,
      dto.description,
      dto.frequency,
      dto.targetCount,
      dto.color,
      dto.icon,
    );
    return this.habitRepo.save(habit);
  }
}
