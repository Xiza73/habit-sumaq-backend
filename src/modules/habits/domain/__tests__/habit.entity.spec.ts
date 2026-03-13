import { HabitFrequency } from '../enums/habit-frequency.enum';

import { buildHabit } from './habit.factory';

describe('Habit Entity', () => {
  describe('updateProfile()', () => {
    it('should update name and updatedAt', () => {
      const habit = buildHabit({ name: 'Old name' });
      const before = habit.updatedAt;

      habit.updateProfile('New name', undefined, undefined, undefined, undefined, undefined);

      expect(habit.name).toBe('New name');
      expect(habit.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should update description when provided', () => {
      const habit = buildHabit({ description: null });

      habit.updateProfile('Test', 'New desc', undefined, undefined, undefined, undefined);

      expect(habit.description).toBe('New desc');
    });

    it('should update frequency when provided', () => {
      const habit = buildHabit({ frequency: HabitFrequency.DAILY });

      habit.updateProfile('Test', undefined, HabitFrequency.WEEKLY, undefined, undefined, undefined);

      expect(habit.frequency).toBe(HabitFrequency.WEEKLY);
    });

    it('should update targetCount when provided', () => {
      const habit = buildHabit({ targetCount: 8 });

      habit.updateProfile('Test', undefined, undefined, 10, undefined, undefined);

      expect(habit.targetCount).toBe(10);
    });

    it('should update color and icon when provided', () => {
      const habit = buildHabit({ color: null, icon: null });

      habit.updateProfile('Test', undefined, undefined, undefined, '#FF0000', 'fire');

      expect(habit.color).toBe('#FF0000');
      expect(habit.icon).toBe('fire');
    });

    it('should not update fields when undefined', () => {
      const habit = buildHabit({
        description: 'Original',
        frequency: HabitFrequency.DAILY,
        targetCount: 5,
        color: '#000',
        icon: 'star',
      });

      habit.updateProfile('Test', undefined, undefined, undefined, undefined, undefined);

      expect(habit.description).toBe('Original');
      expect(habit.frequency).toBe(HabitFrequency.DAILY);
      expect(habit.targetCount).toBe(5);
      expect(habit.color).toBe('#000');
      expect(habit.icon).toBe('star');
    });

    it('should set nullable fields to null explicitly', () => {
      const habit = buildHabit({ description: 'Something', color: '#FFF', icon: 'water' });

      habit.updateProfile('Test', null, undefined, undefined, null, null);

      expect(habit.description).toBeNull();
      expect(habit.color).toBeNull();
      expect(habit.icon).toBeNull();
    });
  });

  describe('archive() / unarchive()', () => {
    it('should set isArchived to true', () => {
      const habit = buildHabit({ isArchived: false });

      habit.archive();

      expect(habit.isArchived).toBe(true);
    });

    it('should set isArchived to false', () => {
      const habit = buildHabit({ isArchived: true });

      habit.unarchive();

      expect(habit.isArchived).toBe(false);
    });

    it('should update updatedAt on archive', () => {
      const habit = buildHabit();
      const before = habit.updatedAt;

      habit.archive();

      expect(habit.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('isDeleted()', () => {
    it('should return false when deletedAt is null', () => {
      const habit = buildHabit({ deletedAt: null });
      expect(habit.isDeleted()).toBe(false);
    });

    it('should return true when deletedAt is set', () => {
      const habit = buildHabit({ deletedAt: new Date() });
      expect(habit.isDeleted()).toBe(true);
    });
  });
});
