import { startOfWeekInTimezone } from './start-of-week-utc';

describe('startOfWeekInTimezone', () => {
  // 2026-04-15 is a Wednesday. Lima is UTC-5 → 17:00 UTC = 12:00 local.
  const NOW_WED_LIMA = new Date('2026-04-15T17:00:00.000Z');

  it('returns the Monday of the current week (00:00 local) for monday start', () => {
    const result = startOfWeekInTimezone('America/Lima', 'monday', NOW_WED_LIMA);
    // Monday 2026-04-13 at 00:00 Lima = 05:00 UTC.
    expect(result.toISOString()).toBe('2026-04-13T05:00:00.000Z');
  });

  it('returns the Sunday of the current week (00:00 local) for sunday start', () => {
    const result = startOfWeekInTimezone('America/Lima', 'sunday', NOW_WED_LIMA);
    // Sunday 2026-04-12 at 00:00 Lima = 05:00 UTC.
    expect(result.toISOString()).toBe('2026-04-12T05:00:00.000Z');
  });

  it('on a Monday morning, returns that same Monday for monday start', () => {
    // Mon 2026-04-13 at 09:00 Lima = 14:00 UTC.
    const monMorning = new Date('2026-04-13T14:00:00.000Z');
    const result = startOfWeekInTimezone('America/Lima', 'monday', monMorning);
    expect(result.toISOString()).toBe('2026-04-13T05:00:00.000Z');
  });

  it('on a Sunday in Lima, monday-week returns the previous Monday', () => {
    // Sun 2026-04-19 at 12:00 Lima = 17:00 UTC.
    const sunday = new Date('2026-04-19T17:00:00.000Z');
    const result = startOfWeekInTimezone('America/Lima', 'monday', sunday);
    expect(result.toISOString()).toBe('2026-04-13T05:00:00.000Z');
  });

  it('respects positive offsets (Auckland UTC+12) — week boundary differs from UTC', () => {
    // 2026-04-12 23:00 UTC = 2026-04-13 11:00 Auckland. Monday already started locally.
    const sunInAucklandIsMon = new Date('2026-04-12T23:00:00.000Z');
    const result = startOfWeekInTimezone('Pacific/Auckland', 'monday', sunInAucklandIsMon);
    // 2026-04-13 00:00 Auckland = 2026-04-12 12:00 UTC.
    expect(result.toISOString()).toBe('2026-04-12T12:00:00.000Z');
  });

  it('falls back to UTC week start for unknown zones', () => {
    const wedUtc = new Date('2026-04-15T17:00:00.000Z');
    const result = startOfWeekInTimezone('Not/A_Zone', 'monday', wedUtc);
    // Monday 2026-04-13 at 00:00 UTC.
    expect(result.toISOString()).toBe('2026-04-13T00:00:00.000Z');
  });
});
