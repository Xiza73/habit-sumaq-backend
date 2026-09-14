import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

import { StatsCalculator } from './stats-calculator';

import type { HabitLog } from '../../domain/habit-log.entity';

/**
 * Which period, if any, a streak shield can be spent on right now.
 *
 * The window is expressed in PERIODS, not days. A DAILY habit's period is the
 * day; a WEEKLY habit's is the ISO week. Writing this in days would silently
 * make a weekly habit rescuable the morning after a missed week and dead by
 * Tuesday — the unit has to be the same one the streak is counted in.
 *
 * A period is rescuable when all three hold:
 *
 *   1. The PREVIOUS period is not held — no completed log, no earlier rescue.
 *      That is the gap.
 *   2. The period BEFORE it is held. Without this there is no streak to save:
 *      bridging one hole while an older one stands restores nothing, and
 *      charging a shield for that would be theft.
 *   3. We are still in the period right after the gap. That falls out of only
 *      ever looking one period back — miss two in a row and the older one is
 *      simply never offered again.
 *
 * Returns the date to record, or `null` when nothing is rescuable. For a
 * WEEKLY habit the date is the Monday of the rescued week, matching what
 * `habit_streak_rescues.rescuedDate` stores.
 *
 * Deliberately pure: no repositories, no clock of its own. Every input is
 * passed in so the whole rule is testable without a database.
 */
export function findRescuableDate(
  frequency: HabitFrequency,
  completedLogs: HabitLog[],
  rescuedDates: readonly string[],
  today: Date,
): string | null {
  return frequency === HabitFrequency.DAILY
    ? findRescuableDay(completedLogs, rescuedDates, today)
    : findRescuableWeek(completedLogs, rescuedDates, today);
}

function findRescuableDay(
  completedLogs: HabitLog[],
  rescuedDates: readonly string[],
  today: Date,
): string | null {
  const completed = new Set(completedLogs.map((log) => StatsCalculator.toDateString(log.date)));
  const rescued = new Set(rescuedDates);
  const holds = (key: string): boolean => completed.has(key) || rescued.has(key);

  const previous = dayOffset(today, -1);
  const before = dayOffset(today, -2);

  return !holds(previous) && holds(before) ? previous : null;
}

function findRescuableWeek(
  completedLogs: HabitLog[],
  rescuedDates: readonly string[],
  today: Date,
): string | null {
  const completedWeeks = new Set(completedLogs.map((log) => StatsCalculator.toWeekKey(log.date)));
  const rescuedWeeks = new Set(rescuedDates.map((date) => StatsCalculator.toWeekKey(date)));
  const holds = (key: string): boolean => completedWeeks.has(key) || rescuedWeeks.has(key);

  const previous = dayOffset(today, -7);
  const before = dayOffset(today, -14);

  return !holds(StatsCalculator.toWeekKey(previous)) && holds(StatsCalculator.toWeekKey(before))
    ? StatsCalculator.toWeekStart(new Date(`${previous}T12:00:00`))
    : null;
}

/** `today` shifted by `days`, as `YYYY-MM-DD`. */
function dayOffset(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return StatsCalculator.toDateString(d);
}
