import { DomainException } from '@common/exceptions/domain.exception';

import { Reminder } from '../reminder.entity';

interface BuildOverrides {
  id?: string;
  userId?: string;
  title?: string;
  notes?: string | null;
  remindDate?: string | null;
  remindTime?: string | null;
  completed?: boolean;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function build(overrides: BuildOverrides = {}) {
  const base = {
    id: 'rem-1',
    userId: 'user-1',
    title: 'Llamar al dentista',
    notes: null as string | null,
    remindDate: null as string | null,
    remindTime: null as string | null,
    completed: false,
    completedAt: null as Date | null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
  return new Reminder(
    base.id,
    base.userId,
    base.title,
    base.notes,
    base.remindDate,
    base.remindTime,
    base.completed,
    base.completedAt,
    base.createdAt,
    base.updatedAt,
  );
}

describe('Reminder', () => {
  describe('shape', () => {
    it('accepts a bare note with no date and no time', () => {
      // This is the case that makes Reminders a superset of Priorities: the
      // user writes something down before knowing when it happens.
      const reminder = build();
      expect(reminder.remindDate).toBeNull();
      expect(reminder.remindTime).toBeNull();
    });

    it('accepts a date with no time', () => {
      const reminder = build({ remindDate: '2026-05-20' });
      expect(reminder.remindDate).toBe('2026-05-20');
      expect(reminder.remindTime).toBeNull();
    });

    it('accepts a date and a time', () => {
      const reminder = build({ remindDate: '2026-05-20', remindTime: '15:00' });
      expect(reminder.remindTime).toBe('15:00');
    });

    it('rejects a time with no date — a time alone says nothing about WHEN', () => {
      expect(() => build({ remindDate: null, remindTime: '15:00' })).toThrow(DomainException);
    });

    it('rejects an empty title', () => {
      expect(() => build({ title: '   ' })).toThrow(DomainException);
    });

    it('rejects a malformed date', () => {
      expect(() => build({ remindDate: '20/05/2026' })).toThrow(DomainException);
    });

    it('rejects a malformed time', () => {
      expect(() => build({ remindDate: '2026-05-20', remindTime: '3pm' })).toThrow(DomainException);
      expect(() => build({ remindDate: '2026-05-20', remindTime: '25:00' })).toThrow(
        DomainException,
      );
    });
  });

  describe('isDueOn', () => {
    it('is never due when it has no date', () => {
      expect(build().isDueOn('2026-05-20', 15)).toBe(false);
    });

    it('is due on its date when it has no time', () => {
      const reminder = build({ remindDate: '2026-05-20' });
      expect(reminder.isDueOn('2026-05-20', 0)).toBe(true);
      expect(reminder.isDueOn('2026-05-20', 23)).toBe(true);
    });

    it('is due on any LATER day too — a reminder you did not act on is still pending', () => {
      const reminder = build({ remindDate: '2026-05-20' });
      expect(reminder.isDueOn('2026-05-25', 9)).toBe(true);
    });

    it('is not due before its date', () => {
      expect(build({ remindDate: '2026-05-20' }).isDueOn('2026-05-19', 23)).toBe(false);
    });

    it('waits for the hour on the day it is set for', () => {
      const reminder = build({ remindDate: '2026-05-20', remindTime: '15:00' });
      expect(reminder.isDueOn('2026-05-20', 14)).toBe(false);
      expect(reminder.isDueOn('2026-05-20', 15)).toBe(true);
      expect(reminder.isDueOn('2026-05-20', 16)).toBe(true);
    });

    it('ignores the hour on a later day — the moment has passed, it is just late', () => {
      // Otherwise a 23:00 reminder from last week would hide itself every
      // morning and only reappear after 23:00, which is how you lose it.
      const reminder = build({ remindDate: '2026-05-20', remindTime: '23:00' });
      expect(reminder.isDueOn('2026-05-21', 8)).toBe(true);
    });

    it('is never due once completed', () => {
      const reminder = build({ remindDate: '2026-05-20', completed: true });
      expect(reminder.isDueOn('2026-05-20', 12)).toBe(false);
    });
  });

  describe('applyUpdate', () => {
    it('stamps completedAt when it is completed and clears it when reopened', () => {
      const reminder = build();
      reminder.applyUpdate({ completed: true });
      expect(reminder.completedAt).toBeInstanceOf(Date);

      reminder.applyUpdate({ completed: false });
      expect(reminder.completedAt).toBeNull();
    });

    it('lets a date be cleared, and drops the orphaned time with it', () => {
      // Clearing the date without clearing the time would leave the invalid
      // time-without-date state the constructor refuses to build.
      const reminder = build({ remindDate: '2026-05-20', remindTime: '15:00' });
      reminder.applyUpdate({ remindDate: null });

      expect(reminder.remindDate).toBeNull();
      expect(reminder.remindTime).toBeNull();
    });

    it('refuses to set a time on a reminder that has no date', () => {
      const reminder = build();
      expect(() => reminder.applyUpdate({ remindTime: '15:00' })).toThrow(DomainException);
    });

    it('accepts a date and a time set together in one update', () => {
      const reminder = build();
      reminder.applyUpdate({ remindDate: '2026-06-01', remindTime: '09:30' });

      expect(reminder.remindDate).toBe('2026-06-01');
      expect(reminder.remindTime).toBe('09:30');
    });
  });
});
