import { hourInTimezone } from '../hour-in-timezone';

describe('hourInTimezone', () => {
  it('returns the local hour (0..23) for a known IANA zone', () => {
    // 12:00 UTC = 07:00 in America/Lima (UTC-5 year-round).
    const noon = new Date('2026-05-19T12:00:00.000Z');
    expect(hourInTimezone('America/Lima', noon)).toBe(7);
    expect(hourInTimezone('UTC', noon)).toBe(12);
  });

  it('handles the midday boundary needed by the habits alert gate', () => {
    // The use case suppresses habits-midday alerts when hour < 12. Cover
    // the exact boundary in the user's TZ.
    const at1159Lima = new Date('2026-05-19T16:59:00.000Z'); // 11:59 Lima
    const at1200Lima = new Date('2026-05-19T17:00:00.000Z'); // 12:00 Lima
    expect(hourInTimezone('America/Lima', at1159Lima)).toBe(11);
    expect(hourInTimezone('America/Lima', at1200Lima)).toBe(12);
  });

  it('falls back to UTC hour when the timezone is invalid (safety net)', () => {
    const at = new Date('2026-05-19T08:30:00.000Z');
    expect(hourInTimezone('Not/A_Zone', at)).toBe(8);
  });
});
