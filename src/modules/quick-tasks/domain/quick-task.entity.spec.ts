import { DomainException } from '@common/exceptions/domain.exception';

import { buildQuickTask } from './__tests__/quick-task.factory';
import { QuickTask } from './quick-task.entity';

describe('QuickTask', () => {
  describe('constructor validation', () => {
    it('rejects empty title', () => {
      expect(() => buildQuickTask({ title: '' })).toThrow(DomainException);
    });

    it('rejects whitespace-only title', () => {
      expect(() => buildQuickTask({ title: '   ' })).toThrow(DomainException);
    });

    it('rejects title over 120 chars', () => {
      expect(() => buildQuickTask({ title: 'a'.repeat(121) })).toThrow(DomainException);
    });

    it('accepts title at the 120-char boundary', () => {
      expect(() => buildQuickTask({ title: 'a'.repeat(120) })).not.toThrow();
    });

    it('rejects description over 5000 chars', () => {
      expect(() => buildQuickTask({ description: 'x'.repeat(5001) })).toThrow(DomainException);
    });

    it('accepts null description', () => {
      expect(() => buildQuickTask({ description: null })).not.toThrow();
    });
  });

  describe('applyUpdate', () => {
    it('updates title', () => {
      const task = buildQuickTask({ title: 'Old' });
      task.applyUpdate({ title: 'New' });
      expect(task.title).toBe('New');
    });

    it('validates new title', () => {
      const task = buildQuickTask();
      expect(() => task.applyUpdate({ title: '' })).toThrow(DomainException);
    });

    it('updates description to null (clear)', () => {
      const task = buildQuickTask({ description: 'Note' });
      task.applyUpdate({ description: null });
      expect(task.description).toBeNull();
    });

    it('sets completedAt when completing', () => {
      const task = buildQuickTask({ completed: false, completedAt: null });
      task.applyUpdate({ completed: true });
      expect(task.completed).toBe(true);
      expect(task.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when un-completing', () => {
      const task = buildQuickTask({ completed: true, completedAt: new Date() });
      task.applyUpdate({ completed: false });
      expect(task.completed).toBe(false);
      expect(task.completedAt).toBeNull();
    });

    it('does not touch completedAt when completed flag unchanged', () => {
      const completedAt = new Date('2026-01-01');
      const task = buildQuickTask({ completed: true, completedAt });
      task.applyUpdate({ title: 'New title' });
      expect(task.completedAt).toBe(completedAt);
    });

    it('updates position', () => {
      const task = buildQuickTask({ position: 1 });
      task.applyUpdate({ position: 5 });
      expect(task.position).toBe(5);
    });

    it('bumps updatedAt', () => {
      const task = buildQuickTask({ updatedAt: new Date('2026-01-01') });
      task.applyUpdate({ title: 'New' });
      expect(task.updatedAt.getTime()).toBeGreaterThan(new Date('2026-01-01').getTime());
    });
  });

  describe('QuickTask.assertTitle', () => {
    it('rejects undefined', () => {
      expect(() => QuickTask.assertTitle(undefined as unknown as string)).toThrow(DomainException);
    });
  });
});
