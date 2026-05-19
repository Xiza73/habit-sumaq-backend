/**
 * Returns the current hour-of-day (0..23) in the given IANA timezone.
 * Used by the alerts use case to gate the `habits-midday` trigger —
 * we only surface "no progress on your habits" alerts AFTER noon in
 * the user's local time, regardless of where the server clock is.
 *
 * Falls back to the UTC hour when the timezone isn't recognized — same
 * defensive shape as the other `*-in-timezone` helpers in the codebase.
 */
export function hourInTimezone(timezone: string, now: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(now);
    const raw = parts.find((p) => p.type === 'hour')?.value;
    const hour = raw === undefined ? NaN : Number(raw);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      return hour;
    }
  } catch {
    // fall through
  }
  return now.getUTCHours();
}
