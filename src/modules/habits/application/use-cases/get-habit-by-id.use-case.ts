import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';
import { HabitRepository } from '../../domain/habit.repository';
import { HabitLogRepository } from '../../domain/habit-log.repository';
import { HabitStreakRescueRepository } from '../../domain/habit-streak-rescue.repository';
import { HabitResponseDto } from '../dto/habit-response.dto';

import { resolvePeriodTarget } from './period-target';
import { StatsCalculator } from './stats-calculator';
import { findRescuableDate } from './streak-rescue-window';

@Injectable()
export class GetHabitByIdUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
    private readonly rescueRepo: HabitStreakRescueRepository,
  ) {}

  async execute(id: string, userId: string, timezone: string): Promise<HabitResponseDto> {
    const habit = await this.habitRepo.findById(id);
    if (!habit) {
      throw new DomainException('HABIT_NOT_FOUND', 'Hábito no encontrado');
    }
    if (habit.userId !== userId) {
      throw new DomainException('HABIT_BELONGS_TO_OTHER_USER', 'Este hábito no te pertenece');
    }

    const today = StatsCalculator.todayIn(timezone);
    const todayStr = StatsCalculator.toDateString(today);

    const isWeekly = habit.frequency === HabitFrequency.WEEKLY;
    const weekStartStr = isWeekly ? StatsCalculator.toWeekStart(today) : undefined;

    const [logs, todayLog, weekLogs, rescuedDates] = await Promise.all([
      this.habitLogRepo.findCompletedByHabitId(habit.id),
      this.habitLogRepo.findByHabitIdAndDate(habit.id, todayStr),
      isWeekly
        ? this.habitLogRepo.findByHabitIdAndDateRange(habit.id, weekStartStr!, todayStr)
        : Promise.resolve([]),
      // Rescued periods bridge gaps in the streak walk. Joined into the same
      // round of queries the stats already make per habit.
      this.rescueRepo.findDatesByHabitId(habit.id),
    ]);

    const { currentStreak, longestStreak, completionRate } = StatsCalculator.calculate(
      habit.frequency,
      logs,
      today,
      rescuedDates,
    );

    const periodCount = isWeekly
      ? weekLogs.reduce((sum, l) => sum + l.count, 0)
      : (todayLog?.count ?? 0);
    const periodTarget = resolvePeriodTarget(habit, todayLog);
    const periodCompleted = periodCount >= periodTarget;

    // Pure computation over data already loaded above — no extra query. The
    // window closes on its own as the period passes, so this is recomputed on
    // every read rather than stored.
    const rescuableDate = findRescuableDate(habit.frequency, logs, rescuedDates, today);

    return HabitResponseDto.fromDomainWithStats(
      habit,
      currentStreak,
      longestStreak,
      completionRate,
      todayLog,
      periodCount,
      periodCompleted,
      periodTarget,
      rescuableDate,
    );
  }
}
