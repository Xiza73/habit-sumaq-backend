import { buildAccount } from './__tests__/account.factory';

describe('Account entity', () => {
  describe('credit()', () => {
    it('should increase the balance by the given amount', () => {
      const account = buildAccount({ balance: 100 });
      account.credit(50);
      expect(account.balance).toBe(150);
    });
  });

  describe('debit()', () => {
    it('should decrease the balance by the given amount', () => {
      const account = buildAccount({ balance: 200 });
      account.debit(75);
      expect(account.balance).toBe(125);
    });

    it('should allow negative balance (credit card scenario)', () => {
      const account = buildAccount({ balance: 0 });
      account.debit(100);
      expect(account.balance).toBe(-100);
    });
  });

  describe('archive()', () => {
    it('should set isArchived to true', () => {
      const account = buildAccount({ isArchived: false });
      account.archive();
      expect(account.isArchived).toBe(true);
    });
  });

  describe('restore()', () => {
    it('should set isArchived to false', () => {
      const account = buildAccount({ isArchived: true });
      account.restore();
      expect(account.isArchived).toBe(false);
    });
  });

  describe('updateProfile()', () => {
    it('should update name, color and icon', () => {
      const account = buildAccount({ name: 'Viejo', color: null, icon: null });
      account.updateProfile('Nuevo', '#FF0000', 'wallet');
      expect(account.name).toBe('Nuevo');
      expect(account.color).toBe('#FF0000');
      expect(account.icon).toBe('wallet');
    });

    it('should allow setting color and icon to null', () => {
      const account = buildAccount({ color: '#000000', icon: 'bank' });
      account.updateProfile(account.name, null, null);
      expect(account.color).toBeNull();
      expect(account.icon).toBeNull();
    });
  });

  describe('isDeleted()', () => {
    it('should return false when deletedAt is null', () => {
      const account = buildAccount({ deletedAt: null });
      expect(account.isDeleted()).toBe(false);
    });

    it('should return true when deletedAt is set', () => {
      const account = buildAccount({ deletedAt: new Date() });
      expect(account.isDeleted()).toBe(true);
    });
  });
});
