/**
 * Returns the `Date` (in UTC) corresponding to 00:00:00 of the current week's
 * first day in the given IANA timezone. Used by the tasks lazy-cleanup query
 * so we delete completed tasks whose `completedAt` is earlier than the user's
 * local week start, not UTC midnight of the week start.
 *
 * `startOfWeek` follows the user's preference:
 *  - 'monday' → week starts on Monday (default for most of the world).
 *  - 'sunday' → week starts on Sunday (US convention).
 *
 * The math mirrors `start-of-today-utc.ts` from quick-tasks: read the wall-
 * clock parts in the target zone, derive the offset from the delta to `now`,
 * then rebuild the desired UTC instant.
 *
 * Falls back to UTC week start when the zone is unknown.
 */
export type StartOfWeek = 'monday' | 'sunday';

export function startOfWeekInTimezone(
  timezone: string,
  startOfWeek: StartOfWeek = 'monday',
  now: Date = new Date(),
): Date {
  const parts = formatInTimezone(timezone, now);
  if (!parts) {
    return startOfWeekUtcFallback(now, startOfWeek);
  }

  // Treat the zone's wall-clock reading as if it were UTC and derive the offset.
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offsetMs = asUtc - now.getTime();

  // Local midnight of "today" in the zone, expressed as a UTC instant.
  const localMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  const localMidnight = localMidnightAsUtc - offsetMs;

  // Compute "how many days since the week start" using the zone's local day
  // of week. We rebuild a Date at local midnight to read its weekday — but
  // weekday is timezone-independent for any UTC instant, so we use the
  // pseudo-UTC reading (which represents the local Y/M/D) directly.
  const localDayOfWeek = new Date(localMidnightAsUtc).getUTCDay(); // 0 = Sunday
  const daysSinceStart =
    startOfWeek === 'monday'
      ? (localDayOfWeek + 6) % 7 // Monday = 0
      : localDayOfWeek; // Sunday = 0

  return new Date(localMidnight - daysSinceStart * 24 * 60 * 60 * 1000);
}

function startOfWeekUtcFallback(now: Date, startOfWeek: StartOfWeek): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = d.getUTCDay();
  const daysSinceStart = startOfWeek === 'monday' ? (dayOfWeek + 6) % 7 : dayOfWeek;
  d.setUTCDate(d.getUTCDate() - daysSinceStart);
  return d;
}

interface ZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function formatInTimezone(timezone: string, at: Date): ZoneParts | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const extracted = formatter.formatToParts(at);
    const pick = (t: string): number => {
      const raw = extracted.find((p) => p.type === t)?.value ?? '0';
      // Intl emits "24" for midnight under hour12:false in some locales —
      // normalize to 0 so the offset math doesn't drift by a day.
      return Number(raw === '24' ? '0' : raw);
    };
    return {
      year: pick('year'),
      month: pick('month'),
      day: pick('day'),
      hour: pick('hour'),
      minute: pick('minute'),
      second: pick('second'),
    };
  } catch {
    return null;
  }
}
