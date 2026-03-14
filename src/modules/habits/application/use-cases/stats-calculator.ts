import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

import type { HabitLog } from '../../domain/habit-log.entity';

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
}

export class StatsCalculator {
  static calculate(frequency: HabitFrequency, completedLogs: HabitLog[], today: Date): HabitStats {
    if (frequency === HabitFrequency.DAILY) {
      return StatsCalculator.calculateDaily(completedLogs, today);
    }
    return StatsCalculator.calculateWeekly(completedLogs, today);
  }

  private static calculateDaily(completedLogs: HabitLog[], today: Date): HabitStats {
    const completedDates = new Set(
      completedLogs.map((log) => StatsCalculator.toDateString(log.date)),
    );

    const todayStr = StatsCalculator.toDateString(today);
    const totalDays = 30;

    // Completion rate: completed days / last 30 days
    let completedCount = 0;
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (completedDates.has(StatsCalculator.toDateString(d))) {
        completedCount++;
      }
    }
    const completionRate = Math.round((completedCount / totalDays) * 100) / 100;

    // Current streak: count backwards from today (or yesterday if today not completed)
    let currentStreak = 0;
    const startOffset = completedDates.has(todayStr) ? 0 : 1;
    for (let i = startOffset; ; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (completedDates.has(StatsCalculator.toDateString(d))) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Longest streak within the 30-day window
    let longestStreak = 0;
    let streak = 0;
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (completedDates.has(StatsCalculator.toDateString(d))) {
        streak++;
        if (streak > longestStreak) longestStreak = streak;
      } else {
        streak = 0;
      }
    }

    return { currentStreak, longestStreak, completionRate };
  }

  private static calculateWeekly(completedLogs: HabitLog[], today: Date): HabitStats {
    // Group logs by ISO week
    const weekMap = new Map<string, number>();
    for (const log of completedLogs) {
      const weekKey = StatsCalculator.toWeekKey(log.date);
      weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1);
    }

    const totalWeeks = 4;

    // Completion rate: weeks with at least 1 completed log / last 4 weeks
    let completedWeeks = 0;
    const weekKeys: string[] = [];
    for (let i = 0; i < totalWeeks; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      const key = StatsCalculator.toWeekKey(d);
      weekKeys.push(key);
      if ((weekMap.get(key) ?? 0) > 0) {
        completedWeeks++;
      }
    }
    const completionRate = Math.round((completedWeeks / totalWeeks) * 100) / 100;

    const currentWeekKey = StatsCalculator.toWeekKey(today);

    // Current streak
    let currentStreak = 0;
    const startOffset = (weekMap.get(currentWeekKey) ?? 0) > 0 ? 0 : 1;
    for (let i = startOffset; ; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      const key = StatsCalculator.toWeekKey(d);
      if ((weekMap.get(key) ?? 0) > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Longest streak within the window
    let longestStreak = 0;
    let streak = 0;
    for (let i = totalWeeks - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      const key = StatsCalculator.toWeekKey(d);
      if ((weekMap.get(key) ?? 0) > 0) {
        streak++;
        if (streak > longestStreak) longestStreak = streak;
      } else {
        streak = 0;
      }
    }

    return { currentStreak, longestStreak, completionRate };
  }

  static toDateString(date: Date | string): string {
    if (typeof date === 'string') return date;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private static toWeekKey(date: Date | string): string {
    const d = new Date(typeof date === 'string' ? date + 'T12:00:00' : date);
    d.setHours(0, 0, 0, 0);
    // Set to nearest Thursday (ISO week algorithm)
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
}
