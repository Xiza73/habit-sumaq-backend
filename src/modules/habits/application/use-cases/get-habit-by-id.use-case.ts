import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { HabitRepository } from '../../domain/habit.repository';
import { HabitLogRepository } from '../../domain/habit-log.repository';
import { HabitResponseDto } from '../dto/habit-response.dto';

import { StatsCalculator } from './stats-calculator';

@Injectable()
export class GetHabitByIdUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
  ) {}

  async execute(id: string, userId: string): Promise<HabitResponseDto> {
    const habit = await this.habitRepo.findById(id);
    if (!habit) {
      throw new DomainException('HABIT_NOT_FOUND', 'Hábito no encontrado');
    }
    if (habit.userId !== userId) {
      throw new DomainException('HABIT_BELONGS_TO_OTHER_USER', 'Este hábito no te pertenece');
    }

    const today = new Date();
    const todayStr = StatsCalculator.toDateString(today);
    const since = new Date(today);
    since.setDate(since.getDate() - 30);
    const sinceStr = StatsCalculator.toDateString(since);

    const [logs, todayLog] = await Promise.all([
      this.habitLogRepo.findCompletedByHabitIdSince(habit.id, sinceStr),
      this.habitLogRepo.findByHabitIdAndDate(habit.id, todayStr),
    ]);

    const { currentStreak, longestStreak, completionRate } = StatsCalculator.calculate(
      habit.frequency,
      logs,
      today,
    );

    return HabitResponseDto.fromDomainWithStats(
      habit,
      currentStreak,
      longestStreak,
      completionRate,
      todayLog,
    );
  }
}
