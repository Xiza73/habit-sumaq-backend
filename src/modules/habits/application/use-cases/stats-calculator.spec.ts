import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';
import { buildHabitLog } from '../../domain/__tests__/habit-log.factory';

import { StatsCalculator } from './stats-calculator';

describe('StatsCalculator', () => {
  describe('Daily', () => {
    const today = new Date('2026-03-13');

    it('should return all zeros when no completed logs', () => {
      const result = StatsCalculator.calculate(HabitFrequency.DAILY, [], today);

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.completionRate).toBe(0);
    });

    it('should calculate currentStreak starting from today', () => {
      const logs = [
        buildHabitLog({ date: new Date('2026-03-13'), completed: true }),
        buildHabitLog({ date: new Date('2026-03-12'), completed: true }),
        buildHabitLog({ date: new Date('2026-03-11'), completed: true }),
      ];

      const result = StatsCalculator.calculate(HabitFrequency.DAILY, logs, today);

      expect(result.currentStreak).toBe(3);
    });

    it('should start streak from yesterday if today not completed', () => {
      const logs = [
        buildHabitLog({ date: new Date('2026-03-12'), completed: true }),
        buildHabitLog({ date: new Date('2026-03-11'), completed: true }),
      ];

      const result = StatsCalculator.calculate(HabitFrequency.DAILY, logs, today);

      expect(result.currentStreak).toBe(2);
    });

    it('should return 0 streak if today and yesterday not completed', () => {
      const logs = [
        buildHabitLog({ date: new Date('2026-03-10'), completed: true }),
      ];

      const result = StatsCalculator.calculate(HabitFrequency.DAILY, logs, today);

      expect(result.currentStreak).toBe(0);
    });

    it('should calculate longestStreak correctly', () => {
      const logs = [
        // Gap on 2026-03-13 and 2026-03-12
        buildHabitLog({ date: new Date('2026-03-08'), completed: true }),
        buildHabitLog({ date: new Date('2026-03-07'), completed: true }),
        buildHabitLog({ date: new Date('2026-03-06'), completed: true }),
        buildHabitLog({ date: new Date('2026-03-05'), completed: true }),
        // Gap on 2026-03-04
        buildHabitLog({ date: new Date('2026-03-03'), completed: true }),
      ];

      const result = StatsCalculator.calculate(HabitFrequency.DAILY, logs, today);

      expect(result.longestStreak).toBe(4);
    });

    it('should calculate completionRate over 30 days', () => {
      // 15 completed days out of 30
      const logs: ReturnType<typeof buildHabitLog>[] = [];
      for (let i = 0; i < 15; i++) {
        const d = new Date('2026-03-13');
        d.setDate(d.getDate() - i * 2); // every other day
        logs.push(buildHabitLog({ date: d, completed: true }));
      }

      const result = StatsCalculator.calculate(HabitFrequency.DAILY, logs, today);

      expect(result.completionRate).toBe(0.5);
    });
  });

  describe('Weekly', () => {
    const today = new Date('2026-03-13'); // A Friday

    it('should return all zeros when no completed logs', () => {
      const result = StatsCalculator.calculate(HabitFrequency.WEEKLY, [], today);

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.completionRate).toBe(0);
    });

    it('should count completed weeks', () => {
      // Logs in current week and last week
      const logs = [
        buildHabitLog({ date: new Date('2026-03-13'), completed: true }),
        buildHabitLog({ date: new Date('2026-03-06'), completed: true }),
      ];

      const result = StatsCalculator.calculate(HabitFrequency.WEEKLY, logs, today);

      expect(result.currentStreak).toBeGreaterThanOrEqual(1);
      expect(result.completionRate).toBeGreaterThan(0);
    });
  });

  describe('toDateString()', () => {
    it('should format date as YYYY-MM-DD', () => {
      expect(StatsCalculator.toDateString(new Date('2026-03-13T15:30:00Z'))).toBe('2026-03-13');
    });

    it('should pad month and day with zeros', () => {
      expect(StatsCalculator.toDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
  });
});
