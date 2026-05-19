/**
 * Returns the UTC `Date` for the end of "today" in the given IANA timezone.
 * "End of today" = the first instant of tomorrow's local calendar day
 * (so the dismiss is active up to but not including midnight).
 *
 * Used by `DismissAlertUseCase` to set the per-day dismiss `expiresAt`:
 * the user's "Cerrar" hides the alert until their local midnight — at
 * which point the next `GET /alerts` call sees the dismiss as expired
 * and the alert resurfaces (if the underlying condition still holds).
 *
 * Implementation notes:
 *  - Extract the local Y/M/D using `Intl.DateTimeFormat` (the only
 *    reliable cross-platform way to read a timestamp in a named zone).
 *  - Add 1 day to the local Y/M/D.
 *  - Convert "midnight tomorrow in the user's zone" back to a UTC
 *    `Date` by iterating: take a candidate UTC instant, format it in
 *    the zone, compare the difference, adjust by the diff. One pass is
 *    enough because DST transitions never shift by more than 1 hour,
 *    so the first-pass candidate is at most an hour off.
 *
 * Falls back to UTC end-of-day for unknown zones (matches the other
 * `*-in-timezone` helpers).
 */
export function endOfDayInTimezone(timezone: string, now: Date = new Date()): Date {
  const local = extractLocalDate(timezone, now);
  if (!local) {
    // Unknown zone — fall back to UTC end of today (start of tomorrow UTC).
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
    );
    return d;
  }

  // Tomorrow's local Y/M/D. Day overflow auto-rolls in the Date constructor.
  const target = { year: local.year, month: local.month, day: local.day + 1 };

  // First-pass candidate: "midnight tomorrow" treated as if local were UTC.
  // Then measure how far that candidate is from the true local midnight
  // (using the same `Intl.DateTimeFormat` round-trip) and correct.
  const candidate = new Date(Date.UTC(target.year, target.month - 1, target.day, 0, 0, 0, 0));
  const candidateLocal = extractLocalDate(timezone, candidate, /* withMinutes */ true);
  if (!candidateLocal) return candidate;

  // Build a "what we wanted vs what we got" comparison in seconds.
  const wantedUTC = Date.UTC(target.year, target.month - 1, target.day, 0, 0, 0, 0);
  const gotUTC = Date.UTC(
    candidateLocal.year,
    candidateLocal.month - 1,
    candidateLocal.day,
    candidateLocal.hour ?? 0,
    candidateLocal.minute ?? 0,
    0,
    0,
  );
  const diffMs = wantedUTC - gotUTC;
  return new Date(candidate.getTime() + diffMs);
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}

function extractLocalDate(timezone: string, at: Date, withMinutes = false): LocalParts | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(withMinutes ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
    });
    const parts = formatter.formatToParts(at);
    const pick = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? 'NaN');
    const year = pick('year');
    const month = pick('month');
    const day = pick('day');
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const out: LocalParts = { year, month, day };
    if (withMinutes) {
      out.hour = pick('hour');
      out.minute = pick('minute');
    }
    return out;
  } catch {
    return null;
  }
}
