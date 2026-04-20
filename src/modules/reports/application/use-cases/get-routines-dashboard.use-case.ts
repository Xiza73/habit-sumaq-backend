import { Injectable } from '@nestjs/common';

// Reuse the existing stats engine so the dashboard reports identical streak
// numbers to what GET /habits already shows on the habits page — a divergence
// would be more confusing than useful.
import { StatsCalculator } from '@modules/habits/application/use-cases/stats-calculator';
import { HabitFrequency } from '@modules/habits/domain/enums/habit-frequency.enum';
import { HabitRepository } from '@modules/habits/domain/habit.repository';
import { HabitLogRepository } from '@modules/habits/domain/habit-log.repository';
import { QuickTaskRepository } from '@modules/quick-tasks/domain/quick-task.repository';
import { StartOfWeek } from '@modules/users/domain/enums/start-of-week.enum';
import { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { type RoutinesDashboardResponseDto } from '../dto/routines-dashboard-response.dto';
import { computePeriodRange, type Period } from '../utils/period-range';

const TOP_STREAKS_LIMIT = 5;
const STATS_WINDOW_DAYS = 30;
const DEFAULT_PERIOD: Period = 'month';
const DEFAULT_TIMEZONE = 'UTC';

@Injectable()
export class GetRoutinesDashboardUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
    private readonly quickTaskRepo: QuickTaskRepository,
    private readonly settingsRepo: UserSettingsRepository,
  ) {}

  async execute(
    userId: string,
    period: Period = DEFAULT_PERIOD,
  ): Promise<RoutinesDashboardResponseDto> {
    const settings = await this.settingsRepo.findByUserId(userId);
    const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;
    const startOfWeek = settings?.startOfWeek ?? StartOfWeek.MONDAY;

    const range = computePeriodRange(period, timezone, startOfWeek);
    const today = StatsCalculator.todayIn(timezone);
    const todayStr = StatsCalculator.toDateString(today);

    const [habits, quickTasks] = await Promise.all([
      this.habitRepo.findByUserId(userId, false),
      this.quickTaskRepo.findByUserId(userId),
    ]);

    // Build habit stats for each active habit. We load completed logs within
    // the stats window in parallel and hand the result to StatsCalculator.
    const statsSince = new Date(today);
    statsSince.setDate(statsSince.getDate() - STATS_WINDOW_DAYS);
    const sinceStr = StatsCalculator.toDateString(statsSince);

    const habitsWithStats = await Promise.all(
      habits.map(async (habit) => {
        const logs = await this.habitLogRepo.findCompletedByHabitIdSince(habit.id, sinceStr);
        const stats = StatsCalculator.calculate(habit.frequency, logs, today);
        return { habit, stats };
      }),
    );

    // Widget: topHabitStreaks — sorted by currentStreak DESC, tie-broken by
    // longestStreak so perfectly-matched streaks still get a stable order.
    const topHabitStreaks = habitsWithStats
      .slice()
      .sort((a, b) =>
        b.stats.currentStreak - a.stats.currentStreak !== 0
          ? b.stats.currentStreak - a.stats.currentStreak
          : b.stats.longestStreak - a.stats.longestStreak,
      )
      .slice(0, TOP_STREAKS_LIMIT)
      .map(({ habit, stats }) => ({
        habitId: habit.id,
        name: habit.name,
        color: habit.color,
        frequency: habit.frequency,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        completionRate: stats.completionRate,
      }));

    // Widget: habitCompletionToday — how many DAILY habits hit their target
    // today. WEEKLY habits would distort this so we count them as "due" only
    // if they aren't already complete for the current ISO week, but the MVP
    // version simply looks at DAILY habits.
    const dailyHabits = habits.filter((h) => h.frequency === HabitFrequency.DAILY);
    const todayLogs = await this.habitLogRepo.findByUserIdAndDate(userId, todayStr);
    const logByHabitId = new Map(todayLogs.map((l) => [l.habitId, l]));
    let completedToday = 0;
    for (const habit of dailyHabits) {
      const log = logByHabitId.get(habit.id);
      if (log && log.count >= habit.targetCount) {
        completedToday += 1;
      }
    }
    const habitCompletionToday = {
      completedToday,
      dueToday: dailyHabits.length,
      rate: dailyHabits.length > 0 ? round(completedToday / dailyHabits.length) : 0,
    };

    // Widget: quickTasksToday — split by completed / pending for KPI cards.
    // The cleanup that runs on GET /quick-tasks already pruned stale
    // completions, so the repo call returns the current-day state by design.
    const quickTasksCompleted = quickTasks.filter((t) => t.completed).length;
    const quickTasksPending = quickTasks.length - quickTasksCompleted;

    return {
      period,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      topHabitStreaks,
      habitCompletionToday,
      quickTasksToday: {
        completed: quickTasksCompleted,
        pending: quickTasksPending,
        total: quickTasks.length,
      },
    };
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
