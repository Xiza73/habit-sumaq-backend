import { Injectable } from '@nestjs/common';

import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';
import { HabitRepository } from '../../domain/habit.repository';
import { HabitLogRepository } from '../../domain/habit-log.repository';
import { HabitResponseDto } from '../dto/habit-response.dto';

import { resolvePeriodTarget } from './period-target';
import { StatsCalculator } from './stats-calculator';

import type { Habit } from '../../domain/habit.entity';

@Injectable()
export class GetDailySummaryUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
  ) {}

  async execute(userId: string, timezone: string, date?: string): Promise<HabitResponseDto[]> {
    // Only active (non-archived) habits
    const habits = await this.habitRepo.findByUserId(userId, false);
    const today = StatsCalculator.todayIn(timezone);
    const referenceDate = date ? new Date(`${date}T12:00:00`) : today;

    return Promise.all(habits.map((habit) => this.buildWithStats(habit, referenceDate, today)));
  }

  private async buildWithStats(
    habit: Habit,
    referenceDate: Date,
    today: Date,
  ): Promise<HabitResponseDto> {
    const refStr = StatsCalculator.toDateString(referenceDate);

    const isWeekly = habit.frequency === HabitFrequency.WEEKLY;

    const weekStartStr: string | undefined = isWeekly
      ? StatsCalculator.toWeekStart(referenceDate)
      : undefined;

    const [logs, dateLog, weekLogs] = await Promise.all([
      this.habitLogRepo.findCompletedByHabitId(habit.id),
      this.habitLogRepo.findByHabitIdAndDate(habit.id, refStr),
      isWeekly
        ? this.habitLogRepo.findByHabitIdAndDateRange(habit.id, weekStartStr!, refStr)
        : Promise.resolve([]),
    ]);

    const { currentStreak, longestStreak, completionRate } = StatsCalculator.calculate(
      habit.frequency,
      logs,
      today,
    );

    const periodCount = isWeekly
      ? weekLogs.reduce((sum, l) => sum + l.count, 0)
      : (dateLog?.count ?? 0);
    const periodTarget = resolvePeriodTarget(habit, dateLog);
    const periodCompleted = periodCount >= periodTarget;

    return HabitResponseDto.fromDomainWithStats(
      habit,
      currentStreak,
      longestStreak,
      completionRate,
      dateLog,
      periodCount,
      periodCompleted,
      periodTarget,
    );
  }
}
