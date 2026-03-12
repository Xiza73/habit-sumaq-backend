import { buildCategory } from './__tests__/category.factory';

describe('Category', () => {
  describe('updateProfile()', () => {
    it('should update name and updatedAt', () => {
      const category = buildCategory({ name: 'Comida' });
      const before = category.updatedAt;

      category.updateProfile('Alimentación', undefined, undefined);

      expect(category.name).toBe('Alimentación');
      expect(category.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should update color when provided', () => {
      const category = buildCategory({ color: '#FF0000' });
      category.updateProfile(category.name, '#00FF00', undefined);
      expect(category.color).toBe('#00FF00');
    });

    it('should update icon when provided', () => {
      const category = buildCategory({ icon: 'food' });
      category.updateProfile(category.name, undefined, 'restaurant');
      expect(category.icon).toBe('restaurant');
    });

    it('should set color to null when explicitly passed null', () => {
      const category = buildCategory({ color: '#FF0000' });
      category.updateProfile(category.name, null, undefined);
      expect(category.color).toBeNull();
    });

    it('should not change color when undefined is passed', () => {
      const category = buildCategory({ color: '#FF0000' });
      category.updateProfile(category.name, undefined, undefined);
      expect(category.color).toBe('#FF0000');
    });
  });

  describe('isDeleted()', () => {
    it('should return false when deletedAt is null', () => {
      const category = buildCategory({ deletedAt: null });
      expect(category.isDeleted()).toBe(false);
    });

    it('should return true when deletedAt is set', () => {
      const category = buildCategory({ deletedAt: new Date() });
      expect(category.isDeleted()).toBe(true);
    });
  });
});
