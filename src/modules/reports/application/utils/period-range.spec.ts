import { StartOfWeek } from '@modules/users/domain/enums/start-of-week.enum';

import { computePeriodRange } from './period-range';

describe('computePeriodRange', () => {
  const now = new Date('2026-04-20T15:00:00Z');
  const tz = 'America/Lima'; // UTC-5, no DST
  const mondayStart = StartOfWeek.MONDAY;

  it('returns the last 7 days for "week"', () => {
    const range = computePeriodRange('week', tz, mondayStart, now);
    expect(range.from.toISOString()).toBe('2026-04-13T15:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-04-20T15:00:00.000Z');
  });

  it('returns the last 30 days for "30d"', () => {
    const range = computePeriodRange('30d', tz, mondayStart, now);
    expect(range.from.toISOString()).toBe('2026-03-21T15:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-04-20T15:00:00.000Z');
  });

  it('starts on the 1st of the current month at local midnight for "month"', () => {
    // 2026-04-20 15:00 UTC = 10:00 Lima on April 20. Local midnight of April 1
    // in Lima (UTC-5) is April 1 05:00 UTC.
    const range = computePeriodRange('month', tz, mondayStart, now);
    expect(range.from.toISOString()).toBe('2026-04-01T05:00:00.000Z');
  });

  it('starts two calendar months back for "3m"', () => {
    // Current month is April. "3m" covers Feb, Mar, Apr → from Feb 1 00:00 Lima
    // = Feb 1 05:00 UTC.
    const range = computePeriodRange('3m', tz, mondayStart, now);
    expect(range.from.toISOString()).toBe('2026-02-01T05:00:00.000Z');
  });

  it('handles the month boundary in UTC+9 (Tokyo)', () => {
    // 2026-04-30 16:00 UTC = 2026-05-01 01:00 Tokyo (May already started).
    // "month" should return May 1 00:00 Tokyo = April 30 15:00 UTC.
    const tokyoNow = new Date('2026-04-30T16:00:00Z');
    const range = computePeriodRange('month', 'Asia/Tokyo', mondayStart, tokyoNow);
    expect(range.from.toISOString()).toBe('2026-04-30T15:00:00.000Z');
  });

  it('falls back to UTC math for unknown timezones', () => {
    const range = computePeriodRange('month', 'Mars/Olympus', mondayStart, now);
    expect(range.from.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
});
