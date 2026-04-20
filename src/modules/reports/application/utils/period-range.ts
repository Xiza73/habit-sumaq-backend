import { type StartOfWeek } from '@modules/users/domain/enums/start-of-week.enum';

/**
 * Period slices available on the dashboard endpoints.
 *
 * - `week`  — last 7 days (rolling, timezone-independent)
 * - `30d`   — last 30 days (rolling)
 * - `month` — current calendar month in the user's timezone (from the 1st at 00:00 local, to now)
 * - `3m`    — current month + the two previous calendar months in the user's timezone
 */
export const PERIOD_VALUES = ['week', '30d', 'month', '3m'] as const;
export type Period = (typeof PERIOD_VALUES)[number];

export interface DateRange {
  /** Inclusive lower bound. */
  from: Date;
  /** Inclusive upper bound (typically `now`). */
  to: Date;
}

export function computePeriodRange(
  period: Period,
  timezone: string,
  _startOfWeek: StartOfWeek,
  now: Date = new Date(),
): DateRange {
  const to = new Date(now);

  if (period === 'week') {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 7);
    return { from, to };
  }

  if (period === '30d') {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 30);
    return { from, to };
  }

  // `month` and `3m` are calendar-aligned: we need the 1st of the starting
  // month at 00:00 in the user's timezone, converted to UTC.
  const parts = getTimezoneParts(timezone, now);
  if (!parts) {
    // Unknown zone — fall back to UTC calendar math.
    const utc = now;
    const year = utc.getUTCFullYear();
    const month = utc.getUTCMonth();
    if (period === 'month') {
      return { from: new Date(Date.UTC(year, month, 1)), to };
    }
    // '3m': two full months before the current one.
    return { from: new Date(Date.UTC(year, month - 2, 1)), to };
  }

  const targetMonthOffset = period === 'month' ? 0 : -2;
  return {
    from: buildZoneMidnightAsUtc(parts.year, parts.month + targetMonthOffset, 1, timezone, now),
    to,
  };
}

interface ZoneParts {
  year: number;
  /** 0-indexed to match JS Date (Jan=0). */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getTimezoneParts(timezone: string, at: Date): ZoneParts | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(at);
    const pick = (t: string): number => {
      const raw = parts.find((p) => p.type === t)?.value ?? '0';
      return Number(raw === '24' ? '0' : raw);
    };
    return {
      year: pick('year'),
      month: pick('month') - 1,
      day: pick('day'),
      hour: pick('hour'),
      minute: pick('minute'),
      second: pick('second'),
    };
  } catch {
    return null;
  }
}

/**
 * Returns the UTC `Date` corresponding to `YYYY-MM-DD 00:00:00` wall-clock
 * in the given timezone. Uses the same offset trick as `startOfTodayInTimezone`
 * in the quick-tasks module: treat the zone's current reading as UTC, diff
 * against `now` to derive the offset, then apply it.
 */
function buildZoneMidnightAsUtc(
  year: number,
  monthZeroIndexed: number,
  day: number,
  timezone: string,
  now: Date,
): Date {
  const currentParts = getTimezoneParts(timezone, now);
  if (!currentParts) {
    return new Date(Date.UTC(year, monthZeroIndexed, day));
  }
  const currentAsUtc = Date.UTC(
    currentParts.year,
    currentParts.month,
    currentParts.day,
    currentParts.hour,
    currentParts.minute,
    currentParts.second,
  );
  const offsetMs = currentAsUtc - now.getTime();
  const targetLocalAsUtc = Date.UTC(year, monthZeroIndexed, day, 0, 0, 0);
  return new Date(targetLocalAsUtc - offsetMs);
}
