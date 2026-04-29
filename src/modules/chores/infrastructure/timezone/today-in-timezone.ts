/**
 * Returns the current date in the given IANA timezone formatted as
 * `YYYY-MM-DD`. Used to evaluate "is this chore overdue" relative to the
 * user's local "today" instead of the server clock's UTC day.
 *
 * Mirrors `currentPeriodInTimezone` from monthly-services but at day-level
 * resolution. Falls back to UTC when the zone is unknown — the frontend
 * always sends a canonical zone via the `x-timezone` header, so the fallback
 * is a safety net rather than an expected path.
 */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  const parts = extractParts(timezone, now);
  if (!parts) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function extractParts(
  timezone: string,
  at: Date,
): { year: number; month: number; day: number } | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const out = formatter.formatToParts(at);
    const pick = (t: string): number => {
      const raw = out.find((p) => p.type === t)?.value ?? '0';
      return Number(raw);
    };
    return { year: pick('year'), month: pick('month'), day: pick('day') };
  } catch {
    return null;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
