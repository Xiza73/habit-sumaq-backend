import { buildUser } from './__tests__/user.factory';

describe('User entity', () => {
  describe('deactivate()', () => {
    it('should set isActive to false', () => {
      const user = buildUser({ isActive: true });
      user.deactivate();
      expect(user.isActive).toBe(false);
    });
  });

  describe('updateProfile()', () => {
    it('should update name', () => {
      const user = buildUser({ name: 'Nombre viejo' });
      user.updateProfile('Nombre nuevo');
      expect(user.name).toBe('Nombre nuevo');
    });

    it('should update avatarUrl when provided', () => {
      const user = buildUser({ avatarUrl: null });
      user.updateProfile(user.name, 'https://example.com/avatar.jpg');
      expect(user.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should not change avatarUrl when not provided', () => {
      const user = buildUser({ avatarUrl: 'https://original.com/avatar.jpg' });
      user.updateProfile('Nuevo nombre');
      expect(user.avatarUrl).toBe('https://original.com/avatar.jpg');
    });

    it('should allow setting avatarUrl to null explicitly', () => {
      const user = buildUser({ avatarUrl: 'https://example.com/avatar.jpg' });
      user.updateProfile(user.name, null);
      expect(user.avatarUrl).toBeNull();
    });
  });
});
