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

/**
 * Whether the period containing `referenceDate` is already covered by a rescue.
 *
 * The card, the table and the heatmap all need this: a rescued period has NO
 * log, so without it a day the user paid a shield for renders exactly like a
 * day they simply missed — which is how a shield gets spent twice on the same
 * date, or silently overwritten by logging it after the fact.
 *
 * Matches on the PERIOD, not the date string. A WEEKLY rescue stores the
 * Monday, so asking about a Thursday has to resolve to the same week or the
 * answer is wrong for six days out of seven.
 */
export function isPeriodRescued(
  frequency: HabitFrequency,
  referenceDate: string,
  rescuedDates: readonly string[],
): boolean {
  if (frequency === HabitFrequency.DAILY) {
    return rescuedDates.includes(referenceDate);
  }
  const week = StatsCalculator.toWeekKey(referenceDate);
  return rescuedDates.some((date) => StatsCalculator.toWeekKey(date) === week);
}

/**
 * The stored `rescuedDate` covering `referenceDate`, or `null`.
 *
 * Releasing a rescue needs the row's own key, and for a WEEKLY habit that is
 * the Monday — not whatever day inside the week the user happened to be
 * looking at when they asked to release it.
 */
export function rescuedDateCovering(
  frequency: HabitFrequency,
  referenceDate: string,
  rescuedDates: readonly string[],
): string | null {
  if (frequency === HabitFrequency.DAILY) {
    return rescuedDates.includes(referenceDate) ? referenceDate : null;
  }
  const week = StatsCalculator.toWeekKey(referenceDate);
  return rescuedDates.find((date) => StatsCalculator.toWeekKey(date) === week) ?? null;
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
