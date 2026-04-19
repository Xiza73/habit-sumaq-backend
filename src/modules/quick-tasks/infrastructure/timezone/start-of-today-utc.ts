/**
 * Returns the `Date` (in UTC) corresponding to 00:00:00 of "today" in the
 * given IANA timezone — used by the quick-tasks lazy-cleanup query so we
 * delete completed tasks whose `completedAt` is earlier than the user's
 * local midnight, not UTC midnight.
 *
 * Rationale: Node does not expose a first-class way to build a wall-clock
 * Date in an arbitrary timezone. We cheat by using Intl to extract the
 * current Y/M/D/H/M/S in the target zone, rebuild that reading "as UTC",
 * and derive the offset from the delta to `now`.
 *
 * If the zone is unknown we fall back to UTC midnight.
 */
export function startOfTodayInTimezone(timezone: string, now: Date = new Date()): Date {
  const parts = formatInTimezone(timezone, now);
  if (!parts) {
    // Unknown zone — fall back to UTC midnight.
    const fallback = new Date(now);
    fallback.setUTCHours(0, 0, 0, 0);
    return fallback;
  }

  // Treat the zone's wall-clock reading as if it were UTC.
  // The delta against `now` is the zone's current UTC offset in ms.
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offsetMs = asUtc - now.getTime();

  // Zone-local midnight read as UTC, minus the offset = real UTC instant.
  const localMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  return new Date(localMidnightAsUtc - offsetMs);
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
      // Intl sometimes emits "24" for midnight under hour12:false — normalize.
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
