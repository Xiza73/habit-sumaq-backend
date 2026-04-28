/**
 * Returns the day-of-month (1–31) of `date` interpreted in the given IANA
 * timezone. Used to recompute a monthly service's `dueDay` from past
 * transactions: the user pays around the same day of THEIR local month,
 * not necessarily the UTC one (a 23:00 UTC-5 payment is still "the 15th"
 * for them, even though it's the 16th in UTC).
 *
 * Falls back to UTC when the timezone is unknown — same defensive shape
 * as `currentPeriodInTimezone`.
 */
export function dayInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const raw = parts.find((p) => p.type === 'day')?.value;
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 1 && value <= 31) return value;
  } catch {
    // Unknown zone — fall through.
  }
  return date.getUTCDate();
}
