import { buildHabitLog } from './habit-log.factory';

describe('HabitLog Entity', () => {
  describe('updateCount()', () => {
    it('should update count and set completed to true when count >= targetCount', () => {
      const log = buildHabitLog({ count: 3, completed: false });

      log.updateCount(8, 8);

      expect(log.count).toBe(8);
      expect(log.completed).toBe(true);
    });

    it('should set completed to false when count < targetCount', () => {
      const log = buildHabitLog({ count: 8, completed: true });

      log.updateCount(5, 8);

      expect(log.count).toBe(5);
      expect(log.completed).toBe(false);
    });

    it('should set completed to true when count exceeds targetCount', () => {
      const log = buildHabitLog({ count: 0, completed: false });

      log.updateCount(10, 8);

      expect(log.count).toBe(10);
      expect(log.completed).toBe(true);
    });

    it('should update updatedAt', () => {
      const log = buildHabitLog();
      const before = log.updatedAt;

      log.updateCount(1, 1);

      expect(log.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('isCompleted()', () => {
    it('should return true when completed is true', () => {
      const log = buildHabitLog({ completed: true });
      expect(log.isCompleted()).toBe(true);
    });

    it('should return false when completed is false', () => {
      const log = buildHabitLog({ completed: false });
      expect(log.isCompleted()).toBe(false);
    });
  });
});
