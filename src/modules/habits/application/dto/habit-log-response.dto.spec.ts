import { buildHabitLog } from '../../domain/__tests__/habit-log.factory';

import { HabitLogResponseDto } from './habit-log-response.dto';

describe('HabitLogResponseDto', () => {
  describe('fromDomain()', () => {
    it('should map all fields from a domain HabitLog', () => {
      const log = buildHabitLog({
        count: 5,
        completed: false,
        note: 'Buen día',
      });

      const dto = HabitLogResponseDto.fromDomain(log);

      expect(dto.id).toBe(log.id);
      expect(dto.habitId).toBe(log.habitId);
      expect(dto.date).toBe(log.date);
      expect(dto.count).toBe(5);
      expect(dto.completed).toBe(false);
      expect(dto.note).toBe('Buen día');
      expect(dto.createdAt).toBe(log.createdAt);
      expect(dto.updatedAt).toBe(log.updatedAt);
    });

    it('should not expose userId', () => {
      const log = buildHabitLog();
      const dto = HabitLogResponseDto.fromDomain(log);
      expect(dto).not.toHaveProperty('userId');
    });

    it('should map nullable note as null', () => {
      const log = buildHabitLog({ note: null });
      const dto = HabitLogResponseDto.fromDomain(log);
      expect(dto.note).toBeNull();
    });
  });
});
