import { buildHabitLog } from '../../domain/__tests__/habit-log.factory';
import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

import { StatsCalculator } from './stats-calculator';

describe('StatsCalculator', () => {
  describe('Daily', () => {
    const today = new Date(2026, 2, 13);

    it('should return all zeros when no completed logs', () => {
      const result = StatsCalculator.calculate(HabitFrequency.DAILY, [], today);

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.completionRate).toBe(0);
    });

    it('should calculate currentStreak starting from today', () => {
      const logs = [
        buildHabitLog({ date: '2026-03-13', completed: true }),
        buildHabitLog({ date: '2026-03-12', completed: true }),
        buildHabitLog({ date: '2026-03-11', completed: true }),
      ];

      const result = StatsCalculator.calculate(HabitFrequency.DAILY, logs, today);

      expect(result.currentStreak).toBe(3);
    });

    it('should start streak from yesterday if today not completed', () => {
      const logs = [
        buildHabitLog({ date: '2026-03-12', completed: true }),
        buildHabitLog({ date: '2026-03-11', completed: true }),
      ];

      const result = StatsCalculator.calculate(HabitFrequency.DAILY, logs, today);

      expect(result.currentStreak).toBe(2);
    });

    it('should return 0 streak if today and yesterday not completed', () => {
      const logs = [buildHabitLog({ date: '2026-03-10', completed: true })];

      const result = StatsCalculator.calculate(HabitFrequency.DAILY, logs, today);

      expect(result.currentStreak).toBe(0);
    });

    it('should calculate longestStreak correctly', () => {
      const logs = [
        // Gap on 2026-03-13 and 2026-03-12
        buildHabitLog({ date: '2026-03-08', completed: true }),
        buildHabitLog({ date: '2026-03-07', completed: true }),
        buildHabitLog({ date: '2026-03-06', completed: true }),
        buildHabitLog({ date: '2026-03-05', completed: true }),
        // Gap on 2026-03-04
        buildHabitLog({ date: '2026-03-03', completed: true }),
      ];

      const result = StatsCalculator.calculate(HabitFrequency.DAILY, logs, today);

      expect(result.longestStreak).toBe(4);
    });

    it('should calculate completionRate over 30 days', () => {
      // 15 completed days out of 30
      const logs: ReturnType<typeof buildHabitLog>[] = [];
      for (let i = 0; i < 15; i++) {
        const d = new Date('2026-03-13T12:00:00');
        d.setDate(d.getDate() - i * 2); // every other day
        logs.push(buildHabitLog({ date: StatsCalculator.toDateString(d), completed: true }));
      }

      const result = StatsCalculator.calculate(HabitFrequency.DAILY, logs, today);

      expect(result.completionRate).toBe(0.5);
    });
  });

  describe('Weekly', () => {
    const today = new Date(2026, 2, 13); // A Friday

    it('should return all zeros when no completed logs', () => {
      const result = StatsCalculator.calculate(HabitFrequency.WEEKLY, [], today);

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.completionRate).toBe(0);
    });

    it('should count completed weeks', () => {
      // Logs in current week and last week
      const logs = [
        buildHabitLog({ date: '2026-03-13', completed: true }),
        buildHabitLog({ date: '2026-03-06', completed: true }),
      ];

      const result = StatsCalculator.calculate(HabitFrequency.WEEKLY, logs, today);

      expect(result.currentStreak).toBeGreaterThanOrEqual(1);
      expect(result.completionRate).toBeGreaterThan(0);
    });
  });

  describe('streaks past the completion-rate window', () => {
    // The reported bug: a habit with 40+ consecutive days always showed 30.
    // Two separate caps produced it — the use cases only fetched 30 days of
    // logs, and `longestStreak` looped over a hardcoded 30-day window. Streaks
    // are unbounded by nature; only the completion RATE is a 30-day metric.
    const today = new Date(2026, 2, 13);

    /** `count` consecutive completed days ending `endingDaysAgo` before today. */
    function consecutive(count: number, endingDaysAgo = 0) {
      return Array.from({ length: count }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - endingDaysAgo - i);
        return buildHabitLog({ date: StatsCalculator.toDateString(d), completed: true });
      });
    }

    it('counts a current streak of 45 days as 45, not 30', () => {
      const result = StatsCalculator.calculate(HabitFrequency.DAILY, consecutive(45), today);
      expect(result.currentStreak).toBe(45);
    });

    it('counts a longest streak of 45 days as 45, not 30', () => {
      const result = StatsCalculator.calculate(HabitFrequency.DAILY, consecutive(45), today);
      expect(result.longestStreak).toBe(45);
    });

    it('finds a long past streak that ended before the 30-day window', () => {
      // 40 days ending 60 days ago, then a gap, then 3 recent days. The old
      // 30-day window could not see the 40 at all.
      const logs = [...consecutive(40, 60), ...consecutive(3)];
      const result = StatsCalculator.calculate(HabitFrequency.DAILY, logs, today);
      expect(result.longestStreak).toBe(40);
      expect(result.currentStreak).toBe(3);
    });

    it('keeps completionRate a 30-day metric even with a year of history', () => {
      // 365 completed days. The rate must stay 1 (30/30), NOT grow with the
      // extra history — it is deliberately a rolling 30-day figure.
      const result = StatsCalculator.calculate(HabitFrequency.DAILY, consecutive(365), today);
      expect(result.completionRate).toBe(1);
      expect(result.currentStreak).toBe(365);
    });

    it('caps completionRate at 1 when the streak is longer than the window', () => {
      const result = StatsCalculator.calculate(HabitFrequency.DAILY, consecutive(100), today);
      expect(result.completionRate).toBeLessThanOrEqual(1);
    });
  });

  describe('weekly streaks past the 4-week window', () => {
    const today = new Date(2026, 2, 13); // A Friday

    function consecutiveWeeks(count: number) {
      return Array.from({ length: count }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - i * 7);
        return buildHabitLog({ date: StatsCalculator.toDateString(d), completed: true });
      });
    }

    it('counts a current streak of 12 weeks as 12, not 4', () => {
      const result = StatsCalculator.calculate(HabitFrequency.WEEKLY, consecutiveWeeks(12), today);
      expect(result.currentStreak).toBe(12);
    });

    it('counts a longest streak of 12 weeks as 12, not 4', () => {
      const result = StatsCalculator.calculate(HabitFrequency.WEEKLY, consecutiveWeeks(12), today);
      expect(result.longestStreak).toBe(12);
    });

    it('keeps completionRate a 4-week metric', () => {
      const result = StatsCalculator.calculate(HabitFrequency.WEEKLY, consecutiveWeeks(52), today);
      expect(result.completionRate).toBe(1);
    });
  });

  describe('toDateString()', () => {
    it('should format date as YYYY-MM-DD', () => {
      // Built in LOCAL terms because that is what `toDateString` formats in.
      // A UTC instant only maps to a fixed date string inside a band of
      // offsets: 15:30Z on the 13th is already the 14th at UTC+14.
      expect(StatsCalculator.toDateString(new Date(2026, 2, 13, 15, 30))).toBe('2026-03-13');
    });

    it('should pad month and day with zeros', () => {
      expect(StatsCalculator.toDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
  });
});
