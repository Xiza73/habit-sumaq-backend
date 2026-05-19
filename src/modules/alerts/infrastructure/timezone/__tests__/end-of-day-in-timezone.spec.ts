import { endOfDayInTimezone } from '../end-of-day-in-timezone';

describe('endOfDayInTimezone', () => {
  it('returns the UTC instant that corresponds to local midnight tomorrow', () => {
    // 19:00 UTC on 2026-05-19 = 14:00 America/Lima (UTC-5) on 2026-05-19.
    // End-of-day in Lima = 2026-05-20T00:00 Lima = 2026-05-20T05:00 UTC.
    const at = new Date('2026-05-19T19:00:00.000Z');
    const result = endOfDayInTimezone('America/Lima', at);
    expect(result.toISOString()).toBe('2026-05-20T05:00:00.000Z');
  });

  it('rolls over the month / year boundary correctly', () => {
    // 2026-12-31T20:00 UTC = 2026-12-31T15:00 Lima → end-of-day Lima
    // = 2027-01-01T00:00 Lima = 2027-01-01T05:00 UTC.
    const eve = new Date('2026-12-31T20:00:00.000Z');
    const result = endOfDayInTimezone('America/Lima', eve);
    expect(result.toISOString()).toBe('2027-01-01T05:00:00.000Z');
  });

  it('UTC zone is the trivial case — start of tomorrow UTC', () => {
    const at = new Date('2026-05-19T19:00:00.000Z');
    const result = endOfDayInTimezone('UTC', at);
    expect(result.toISOString()).toBe('2026-05-20T00:00:00.000Z');
  });

  it('falls back to UTC end-of-day on an unknown timezone (safety net)', () => {
    const at = new Date('2026-05-19T19:00:00.000Z');
    const result = endOfDayInTimezone('Not/A_Zone', at);
    expect(result.toISOString()).toBe('2026-05-20T00:00:00.000Z');
  });

  it('an instant already past local midnight returns the next midnight (not the past one)', () => {
    // 04:30 UTC on May 20 = 23:30 May 19 Lima. End-of-day Lima = 00:00
    // May 20 Lima = 05:00 May 20 UTC.
    const lateLima = new Date('2026-05-20T04:30:00.000Z');
    const result = endOfDayInTimezone('America/Lima', lateLima);
    expect(result.toISOString()).toBe('2026-05-20T05:00:00.000Z');
  });
});
