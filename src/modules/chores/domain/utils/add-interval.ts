import { IntervalUnit } from '../enums/interval-unit.enum';

/**
 * Adds `value` units of `unit` to a `YYYY-MM-DD` date and returns the same
 * format. Pure function — no timezone arithmetic, no `Date` instances cross
 * the boundary. Cases:
 *
 * - `days`  : simple add of N days.
 * - `weeks` : N weeks = N * 7 days.
 * - `months`: uses `Date(y, m + n, d)` which JS clamps for month/year overflow
 *   (e.g. Jan 31 + 1 month = Feb 28/29, NOT Mar 3).
 * - `years` : uses `Date(y + n, m, d)`, same clamping (Feb 29 + 1 year =
 *   Feb 28 in non-leap years).
 *
 * Throws if `value` is not a positive integer or `date` is not a
 * `YYYY-MM-DD` string — caller is responsible for validating DTOs upstream,
 * this is a defense-in-depth guard for the repo/use-case boundary.
 */
export function addInterval(date: string, value: number, unit: IntervalUnit): string {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`addInterval: value must be a positive integer, got ${value}`);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`addInterval: date must be YYYY-MM-DD, got ${date}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]); // 1-indexed
  const day = Number(match[3]);

  let nextYear: number;
  let nextMonth: number; // 0-indexed for Date()
  let nextDay: number;

  switch (unit) {
    case IntervalUnit.DAYS:
    case IntervalUnit.WEEKS: {
      const totalDays = unit === IntervalUnit.DAYS ? value : value * 7;
      // Use UTC math so DST never shifts the result by a day.
      const utc = Date.UTC(year, month - 1, day);
      const next = new Date(utc + totalDays * 24 * 60 * 60 * 1000);
      nextYear = next.getUTCFullYear();
      nextMonth = next.getUTCMonth();
      nextDay = next.getUTCDate();
      break;
    }
    case IntervalUnit.MONTHS: {
      // `new Date(year, monthIndex, day)` clamps the day when the target month
      // has fewer days than `day` — exactly what we want. Build with UTC to
      // avoid DST surprises on day boundaries.
      const totalMonths = month - 1 + value;
      const targetYear = year + Math.floor(totalMonths / 12);
      const targetMonth = ((totalMonths % 12) + 12) % 12;
      const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      nextYear = targetYear;
      nextMonth = targetMonth;
      nextDay = Math.min(day, lastDayOfMonth);
      break;
    }
    case IntervalUnit.YEARS: {
      const targetYear = year + value;
      // Feb 29 + N years lands on Feb 28 unless target year is also a leap year.
      const lastDayOfMonth = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
      nextYear = targetYear;
      nextMonth = month - 1;
      nextDay = Math.min(day, lastDayOfMonth);
      break;
    }
    default: {
      // Exhaustiveness check — if a new IntervalUnit is added without
      // updating this switch, TS will complain here.
      const exhaustive: never = unit;
      throw new Error(`addInterval: unsupported unit ${exhaustive as string}`);
    }
  }

  const yyyy = String(nextYear).padStart(4, '0');
  const mm = String(nextMonth + 1).padStart(2, '0');
  const dd = String(nextDay).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
