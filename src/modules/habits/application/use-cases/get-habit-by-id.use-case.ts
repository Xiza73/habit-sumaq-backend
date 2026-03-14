import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';
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

    const isWeekly = habit.frequency === HabitFrequency.WEEKLY;
    const weekStartStr = isWeekly ? StatsCalculator.toWeekStart(today) : undefined;

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
