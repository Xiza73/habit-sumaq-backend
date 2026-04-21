/**
 * Returns the current month in the given IANA timezone formatted as
 * `YYYY-MM`. Used to reason about "is this service paid for THIS month"
 * without depending on the server clock's zone.
 *
 * Mirrors the approach used by quick-tasks' `startOfTodayInTimezone`:
 * fall back to UTC if the zone is unknown — the frontend always sends a
 * canonical zone via the `x-timezone` header, so the fallback is a safety
 * net rather than an expected path.
 */
export function currentPeriodInTimezone(timezone: string, now: Date = new Date()): string {
  const parts = extractParts(timezone, now);
  if (!parts) {
    // Unknown zone — fall back to UTC.
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

function extractParts(timezone: string, at: Date): { year: number; month: number } | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
    });
    const out = formatter.formatToParts(at);
    const pick = (t: string): number => {
      const raw = out.find((p) => p.type === t)?.value ?? '0';
      return Number(raw);
    };
    return { year: pick('year'), month: pick('month') };
  } catch {
    return null;
  }
}
