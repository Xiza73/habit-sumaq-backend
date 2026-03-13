import { Injectable } from '@nestjs/common';

import { HabitRepository } from '../../domain/habit.repository';
import { HabitLogRepository } from '../../domain/habit-log.repository';
import { HabitResponseDto } from '../dto/habit-response.dto';

import { StatsCalculator } from './stats-calculator';

import type { Habit } from '../../domain/habit.entity';

@Injectable()
export class GetDailySummaryUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
  ) {}

  async execute(userId: string): Promise<HabitResponseDto[]> {
    // Only active (non-archived) habits
    const habits = await this.habitRepo.findByUserId(userId, false);
    const today = new Date();

    return Promise.all(habits.map((habit) => this.buildWithStats(habit, today)));
  }

  private async buildWithStats(habit: Habit, today: Date): Promise<HabitResponseDto> {
    const since = new Date(today);
    since.setDate(since.getDate() - 30);

    const [logs, todayLog] = await Promise.all([
      this.habitLogRepo.findCompletedByHabitIdSince(habit.id, since),
      this.habitLogRepo.findByHabitIdAndDate(habit.id, today),
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
