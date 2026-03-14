import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { HabitRepository } from '../../domain/habit.repository';
import { HabitLogRepository } from '../../domain/habit-log.repository';

import type { HabitLog } from '../../domain/habit-log.entity';
import type { GetHabitLogsQueryDto } from '../dto/get-habit-logs-query.dto';

@Injectable()
export class GetHabitLogsUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
  ) {}

  async execute(
    habitId: string,
    userId: string,
    query: GetHabitLogsQueryDto,
  ): Promise<{ data: HabitLog[]; total: number }> {
    const habit = await this.habitRepo.findById(habitId);
    if (!habit) {
      throw new DomainException('HABIT_NOT_FOUND', 'Hábito no encontrado');
    }
    if (habit.userId !== userId) {
      throw new DomainException('HABIT_BELONGS_TO_OTHER_USER', 'Este hábito no te pertenece');
    }

    return this.habitLogRepo.findByHabitId(
      habitId,
      query.dateFrom,
      query.dateTo,
      query.page,
      query.limit,
    );
  }
}
