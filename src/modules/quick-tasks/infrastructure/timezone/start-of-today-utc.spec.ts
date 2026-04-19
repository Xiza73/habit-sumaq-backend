import { startOfTodayInTimezone } from './start-of-today-utc';

describe('startOfTodayInTimezone', () => {
  it('returns UTC midnight for "UTC"', () => {
    const now = new Date('2026-04-19T15:30:00Z'); // 15:30 UTC
    const result = startOfTodayInTimezone('UTC', now);
    expect(result.toISOString()).toBe('2026-04-19T00:00:00.000Z');
  });

  it('returns local midnight for America/Lima (UTC-5, no DST)', () => {
    // It is 02:00 UTC on 2026-04-19, which is 21:00 of 2026-04-18 in Lima.
    // Local midnight in Lima = 00:00 of 2026-04-18 (Lima) = 05:00 UTC of 2026-04-18.
    const now = new Date('2026-04-19T02:00:00Z');
    const result = startOfTodayInTimezone('America/Lima', now);
    expect(result.toISOString()).toBe('2026-04-18T05:00:00.000Z');
  });

  it('returns local midnight for Europe/Madrid during CEST (UTC+2 in summer)', () => {
    // 2026-07-15 10:00 UTC = 12:00 Madrid on 2026-07-15 (CEST active).
    // Local midnight in Madrid = 00:00 on 2026-07-15 Madrid = 22:00 UTC on 2026-07-14.
    const now = new Date('2026-07-15T10:00:00Z');
    const result = startOfTodayInTimezone('Europe/Madrid', now);
    expect(result.toISOString()).toBe('2026-07-14T22:00:00.000Z');
  });

  it('returns local midnight for Asia/Tokyo (UTC+9, no DST)', () => {
    // 2026-04-19 15:00 UTC = 2026-04-20 00:00 Tokyo exactly.
    const now = new Date('2026-04-19T15:00:00Z');
    const result = startOfTodayInTimezone('Asia/Tokyo', now);
    expect(result.toISOString()).toBe('2026-04-19T15:00:00.000Z');
  });

  it('falls back to UTC midnight for unknown zones', () => {
    const now = new Date('2026-04-19T15:30:00Z');
    const result = startOfTodayInTimezone('Not/A/Zone', now);
    expect(result.toISOString()).toBe('2026-04-19T00:00:00.000Z');
  });
});
