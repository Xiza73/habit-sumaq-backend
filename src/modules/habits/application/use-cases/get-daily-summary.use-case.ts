import { Injectable } from '@nestjs/common';

import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';
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
    const todayStr = StatsCalculator.toDateString(today);
    const since = new Date(today);
    since.setDate(since.getDate() - 30);
    const sinceStr = StatsCalculator.toDateString(since);

    const isWeekly = habit.frequency === HabitFrequency.WEEKLY;

    const weekStartStr: string | undefined = isWeekly
      ? StatsCalculator.toWeekStart(today)
      : undefined;

    const [logs, todayLog, weekLogs] = await Promise.all([
      this.habitLogRepo.findCompletedByHabitIdSince(habit.id, sinceStr),
      this.habitLogRepo.findByHabitIdAndDate(habit.id, todayStr),
      isWeekly
        ? this.habitLogRepo.findByHabitIdAndDateRange(habit.id, weekStartStr!, todayStr)
        : Promise.resolve([]),
    ]);

    const { currentStreak, longestStreak, completionRate } = StatsCalculator.calculate(
      habit.frequency,
      logs,
      today,
    );

    const periodCount = isWeekly
      ? weekLogs.reduce((sum, l) => sum + l.count, 0)
      : (todayLog?.count ?? 0);
    const periodCompleted = periodCount >= habit.targetCount;

    return HabitResponseDto.fromDomainWithStats(
      habit,
      currentStreak,
      longestStreak,
      completionRate,
      todayLog,
      periodCount,
      periodCompleted,
    );
  }
}
