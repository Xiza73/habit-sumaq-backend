import { buildBudgetMovement } from './__tests__/budget-movement.factory';

describe('BudgetMovement', () => {
  describe('update', () => {
    it('updates only the provided fields and leaves others untouched', () => {
      const m = buildBudgetMovement({
        amount: 100,
        description: 'Old desc',
        categoryId: 'cat-1',
      });
      m.update({ amount: 250 });

      expect(m.amount).toBe(250);
      expect(m.description).toBe('Old desc');
      expect(m.categoryId).toBe('cat-1');
    });

    it('rounds the new amount to 2 decimal places to defeat float drift', () => {
      const m = buildBudgetMovement({ amount: 100 });
      m.update({ amount: 12.345 });
      expect(m.amount).toBe(12.35);
    });

    it('accepts explicit null to clear a nullable field', () => {
      const m = buildBudgetMovement({ description: 'present', categoryId: 'cat-1' });
      m.update({ description: null, categoryId: null });

      expect(m.description).toBeNull();
      expect(m.categoryId).toBeNull();
    });

    it('bumps updatedAt on every update', () => {
      const original = new Date('2026-01-01T00:00:00.000Z');
      const m = buildBudgetMovement({ updatedAt: original });
      m.update({ amount: 1 });
      expect(m.updatedAt.getTime()).toBeGreaterThan(original.getTime());
    });

    it('updates the date field when provided', () => {
      const m = buildBudgetMovement();
      const newDate = new Date('2026-07-01T00:00:00.000Z');
      m.update({ date: newDate });
      expect(m.date).toBe(newDate);
    });
  });

  describe('isDeleted', () => {
    it('returns true when deletedAt is set', () => {
      expect(buildBudgetMovement({ deletedAt: new Date() }).isDeleted()).toBe(true);
    });

    it('returns false when deletedAt is null', () => {
      expect(buildBudgetMovement({ deletedAt: null }).isDeleted()).toBe(false);
    });
  });
});
