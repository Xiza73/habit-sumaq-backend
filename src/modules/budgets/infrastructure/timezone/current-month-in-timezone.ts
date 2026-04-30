/**
 * Returns the current `{ year, month }` (1-indexed month) in the given IANA
 * timezone. Same defensive shape as `currentPeriodInTimezone` in
 * monthly-services — the budget module needs the parts (year + month
 * separately) rather than a `YYYY-MM` string, so we expose them directly.
 *
 * Falls back to UTC for unknown zones — frontend always sends a canonical
 * zone via the `x-timezone` header, so the fallback is a safety net.
 */
export function currentMonthInTimezone(
  timezone: string,
  now: Date = new Date(),
): { year: number; month: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const pick = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? '0');
    const year = pick('year');
    const month = pick('month');
    if (Number.isFinite(year) && year > 0 && month >= 1 && month <= 12) {
      return { year, month };
    }
  } catch {
    // fall through
  }
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/**
 * Returns the current `{ year, month, day }` in the given IANA timezone.
 * Used by the KPI calculation: `daysRemainingIncludingToday` depends on
 * "today" in the user's frame, not the server's.
 */
export function currentDateInTimezone(
  timezone: string,
  now: Date = new Date(),
): { year: number; month: number; day: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const pick = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? '0');
    const year = pick('year');
    const month = pick('month');
    const day = pick('day');
    if (Number.isFinite(year) && year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  } catch {
    // fall through
  }
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
}

/** Number of days in the given (year, month) — handles leap years correctly. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of next month = last day of current month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
