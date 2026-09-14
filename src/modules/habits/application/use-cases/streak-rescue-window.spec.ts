import { buildHabitLog } from '../../domain/__tests__/habit-log.factory';
import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

import { findRescuableDate } from './streak-rescue-window';

describe('findRescuableDate', () => {
  describe('DAILY', () => {
    // Friday 2026-03-13. Yesterday = 03-12, the day before = 03-11.
    const today = new Date(2026, 2, 13);

    const call = (dates: string[], rescued: string[] = []) =>
      findRescuableDate(
        HabitFrequency.DAILY,
        dates.map((date) => buildHabitLog({ date, completed: true })),
        rescued,
        today,
      );

    it('offers yesterday when it is the only gap', () => {
      expect(call(['2026-03-11', '2026-03-10'])).toBe('2026-03-12');
    });

    it('offers nothing when yesterday was completed — there is no gap', () => {
      expect(call(['2026-03-12', '2026-03-11'])).toBeNull();
    });

    it('offers nothing when the day before the gap is also missing', () => {
      // Two holes in a row: bridging yesterday restores no streak, so charging
      // a shield for it would be theft.
      expect(call(['2026-03-10'])).toBeNull();
    });

    it('offers nothing to a habit with no history at all', () => {
      expect(call([])).toBeNull();
    });

    it('counts an earlier rescue as holding the day before the gap', () => {
      // 03-11 was itself rescued previously; it still anchors the streak, so
      // 03-12 is legitimately rescuable.
      expect(call(['2026-03-10'], ['2026-03-11'])).toBe('2026-03-12');
    });

    it('offers nothing when yesterday was already rescued', () => {
      expect(call(['2026-03-11'], ['2026-03-12'])).toBeNull();
    });

    it('still offers yesterday when today is already done', () => {
      // Logging today does not close the gap behind it — the older streak is
      // still there to reconnect.
      expect(call(['2026-03-13', '2026-03-11'])).toBe('2026-03-12');
    });

    it('never reaches back two periods — a gap missed once is gone', () => {
      // 03-11 is the hole and 03-10 anchors it, but we are a day too late:
      // only the period immediately before today is ever offered.
      expect(call(['2026-03-12', '2026-03-10'])).toBeNull();
    });
  });

  describe('WEEKLY', () => {
    // Friday 2026-03-13. Previous week contains 03-06, the one before 02-27.
    const today = new Date(2026, 2, 13);

    const call = (dates: string[], rescued: string[] = []) =>
      findRescuableDate(
        HabitFrequency.WEEKLY,
        dates.map((date) => buildHabitLog({ date, completed: true })),
        rescued,
        today,
      );

    it('offers the Monday of the missed week', () => {
      // Logged two weeks ago, nothing last week → last week is the gap, and
      // the date recorded is its Monday, which is what the table stores.
      expect(call(['2026-02-27'])).toBe('2026-03-02');
    });

    it('offers nothing when last week had a log', () => {
      expect(call(['2026-03-06', '2026-02-27'])).toBeNull();
    });

    it('offers nothing when the week before the gap is also empty', () => {
      expect(call(['2026-02-20'])).toBeNull();
    });

    it('accepts a log on any day of the anchoring week', () => {
      // The anchor is the WEEK, not a particular weekday — a Sunday log holds
      // it exactly as a Monday one would.
      expect(call(['2026-03-01'])).toBe('2026-03-02');
    });

    it('counts an earlier rescue of the anchoring week', () => {
      expect(call([], ['2026-02-23'])).toBe('2026-03-02');
    });

    it('measures in weeks, not in days', () => {
      // The whole reason the window is expressed in periods: a weekly habit
      // logged 8 days ago has NOT missed last week under a day-based rule
      // either, but a day-based window would have offered "yesterday" — a day
      // that means nothing to a weekly streak.
      expect(call(['2026-03-05'])).toBeNull();
    });
  });
});
