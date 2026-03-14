import { buildHabit } from '../../domain/__tests__/habit.factory';
import { buildHabitLog } from '../../domain/__tests__/habit-log.factory';
import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

import { HabitResponseDto } from './habit-response.dto';

describe('HabitResponseDto', () => {
  describe('fromDomain()', () => {
    it('should map all fields from a domain Habit', () => {
      const habit = buildHabit({
        name: 'Ejercicio',
        description: 'Hacer 30 min',
        frequency: HabitFrequency.DAILY,
        targetCount: 1,
        color: '#4CAF50',
        icon: 'dumbbell',
        isArchived: false,
      });

      const dto = HabitResponseDto.fromDomain(habit);

      expect(dto.id).toBe(habit.id);
      expect(dto.userId).toBe(habit.userId);
      expect(dto.name).toBe('Ejercicio');
      expect(dto.description).toBe('Hacer 30 min');
      expect(dto.frequency).toBe(HabitFrequency.DAILY);
      expect(dto.targetCount).toBe(1);
      expect(dto.color).toBe('#4CAF50');
      expect(dto.icon).toBe('dumbbell');
      expect(dto.isArchived).toBe(false);
      expect(dto.createdAt).toBe(habit.createdAt);
      expect(dto.updatedAt).toBe(habit.updatedAt);
    });

    it('should not expose deletedAt', () => {
      const habit = buildHabit();
      const dto = HabitResponseDto.fromDomain(habit);
      expect(dto).not.toHaveProperty('deletedAt');
    });

    it('should map nullable fields correctly when null', () => {
      const habit = buildHabit({ description: null, color: null, icon: null });
      const dto = HabitResponseDto.fromDomain(habit);
      expect(dto.description).toBeNull();
      expect(dto.color).toBeNull();
      expect(dto.icon).toBeNull();
    });

    it('should not include stats fields in basic fromDomain()', () => {
      const habit = buildHabit();
      const dto = HabitResponseDto.fromDomain(habit);
      expect(dto.currentStreak).toBeUndefined();
      expect(dto.longestStreak).toBeUndefined();
      expect(dto.completionRate).toBeUndefined();
      expect(dto.todayLog).toBeUndefined();
    });
  });

  describe('fromDomainWithStats()', () => {
    it('should include stats and todayLog', () => {
      const habit = buildHabit();
      const todayLog = buildHabitLog({ count: 5, completed: false });

      const dto = HabitResponseDto.fromDomainWithStats(habit, 3, 10, 0.75, todayLog, 5, false);

      expect(dto.currentStreak).toBe(3);
      expect(dto.longestStreak).toBe(10);
      expect(dto.completionRate).toBe(0.75);
      expect(dto.todayLog).toBeDefined();
      expect(dto.todayLog!.count).toBe(5);
      expect(dto.periodCount).toBe(5);
      expect(dto.periodCompleted).toBe(false);
    });

    it('should set todayLog to null when no log exists', () => {
      const habit = buildHabit();

      const dto = HabitResponseDto.fromDomainWithStats(habit, 0, 0, 0, null, 0, false);

      expect(dto.todayLog).toBeNull();
      expect(dto.periodCount).toBe(0);
      expect(dto.periodCompleted).toBe(false);
    });
  });
});
