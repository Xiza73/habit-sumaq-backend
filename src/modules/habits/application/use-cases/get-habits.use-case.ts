import { Injectable } from '@nestjs/common';

import { HabitRepository } from '../../domain/habit.repository';
import { HabitLogRepository } from '../../domain/habit-log.repository';
import { HabitResponseDto } from '../dto/habit-response.dto';

import { StatsCalculator } from './stats-calculator';

import type { Habit } from '../../domain/habit.entity';
import type { GetHabitsQueryDto } from '../dto/get-habits-query.dto';

@Injectable()
export class GetHabitsUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
  ) {}

  async execute(userId: string, query: GetHabitsQueryDto): Promise<HabitResponseDto[]> {
    const habits = await this.habitRepo.findByUserId(userId, query.includeArchived);
    const today = new Date();

    return Promise.all(habits.map((habit) => this.buildHabitWithStats(habit, today)));
  }

  private async buildHabitWithStats(habit: Habit, today: Date): Promise<HabitResponseDto> {
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
