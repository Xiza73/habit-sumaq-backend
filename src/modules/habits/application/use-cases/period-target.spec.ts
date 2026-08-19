import { buildHabit } from '../../domain/__tests__/habit.factory';
import { buildHabitLog } from '../../domain/__tests__/habit-log.factory';
import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

import { resolvePeriodTarget } from './period-target';

describe('resolvePeriodTarget', () => {
  describe('DAILY — the day owns its target', () => {
    it("uses the log's own target, not the habit's", () => {
      // The bug this exists for: raising a habit from 3 to 4 used to turn
      // every finished past day into "3/4". The day keeps what it was
      // written with.
      const habit = buildHabit({ frequency: HabitFrequency.DAILY, targetCount: 4 });
      const log = buildHabitLog({ targetCount: 3, count: 3, completed: true });

      expect(resolvePeriodTarget(habit, log)).toBe(3);
    });

    it('lets a single day ask for MORE than the habit default', () => {
      const habit = buildHabit({ frequency: HabitFrequency.DAILY, targetCount: 3 });
      const log = buildHabitLog({ targetCount: 5, count: 5, completed: true });

      expect(resolvePeriodTarget(habit, log)).toBe(5);
    });

    it('falls back to the habit default for a day with no log yet', () => {
      // Nothing snapshotted, and this is exactly what a fresh log would be
      // written with — so the number shown before and after logging agrees.
      const habit = buildHabit({ frequency: HabitFrequency.DAILY, targetCount: 4 });

      expect(resolvePeriodTarget(habit, null)).toBe(4);
      expect(resolvePeriodTarget(habit, undefined)).toBe(4);
    });
  });

  describe('WEEKLY — the week owns the target', () => {
    it('always uses the habit target, ignoring the log', () => {
      // A weekly objective spans several logs; no single log's snapshot can
      // speak for the week, so using one would be a guess dressed as a rule.
      const habit = buildHabit({ frequency: HabitFrequency.WEEKLY, targetCount: 5 });
      const log = buildHabitLog({ targetCount: 99 });

      expect(resolvePeriodTarget(habit, log)).toBe(5);
    });

    it('uses the habit target with no log either', () => {
      const habit = buildHabit({ frequency: HabitFrequency.WEEKLY, targetCount: 5 });

      expect(resolvePeriodTarget(habit, null)).toBe(5);
    });
  });
});
