import { Injectable } from '@nestjs/common';

import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';
import { HabitRepository } from '../../domain/habit.repository';
import { HabitLogRepository } from '../../domain/habit-log.repository';
import { HabitResponseDto } from '../dto/habit-response.dto';

import { resolvePeriodTarget } from './period-target';
import { StatsCalculator } from './stats-calculator';

import type { Habit } from '../../domain/habit.entity';
import type { GetHabitsQueryDto } from '../dto/get-habits-query.dto';

@Injectable()
export class GetHabitsUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
  ) {}

  async execute(
    userId: string,
    query: GetHabitsQueryDto,
    timezone: string,
  ): Promise<HabitResponseDto[]> {
    const habits = await this.habitRepo.findByUserId(userId, query.includeArchived);
    const today = StatsCalculator.todayIn(timezone);

    return Promise.all(habits.map((habit) => this.buildHabitWithStats(habit, today)));
  }

  private async buildHabitWithStats(habit: Habit, today: Date): Promise<HabitResponseDto> {
    const todayStr = StatsCalculator.toDateString(today);

    const isWeekly = habit.frequency === HabitFrequency.WEEKLY;
    const weekStartStr = isWeekly ? StatsCalculator.toWeekStart(today) : undefined;

    const [logs, todayLog, weekLogs] = await Promise.all([
      this.habitLogRepo.findCompletedByHabitId(habit.id),
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
    const periodTarget = resolvePeriodTarget(habit, todayLog);
    const periodCompleted = periodCount >= periodTarget;

    return HabitResponseDto.fromDomainWithStats(
      habit,
      currentStreak,
      longestStreak,
      completionRate,
      todayLog,
      periodCount,
      periodCompleted,
      periodTarget,
    );
  }
}
