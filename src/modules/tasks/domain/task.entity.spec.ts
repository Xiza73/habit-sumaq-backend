import { DomainException } from '@common/exceptions/domain.exception';

import { Task } from './task.entity';

describe('Task entity', () => {
  function build(overrides: Partial<Task> = {}): Task {
    const now = new Date('2026-04-15T12:00:00.000Z');
    return new Task(
      overrides.id ?? 'task-1',
      overrides.userId ?? 'user-1',
      overrides.sectionId ?? 'sec-1',
      overrides.title ?? 'Comprar pan',
      overrides.description !== undefined ? overrides.description : null,
      overrides.completed ?? false,
      overrides.completedAt !== undefined ? overrides.completedAt : null,
      overrides.position ?? 1,
      overrides.createdAt ?? now,
      overrides.updatedAt ?? now,
    );
  }

  it('throws TASK_TITLE_REQUIRED on empty title', () => {
    expect(() => build({ title: '' })).toThrow(DomainException);
  });

  it('throws TASK_TITLE_TOO_LONG on >120 chars', () => {
    expect(() => build({ title: 'x'.repeat(121) })).toThrow(DomainException);
  });

  it('throws TASK_DESCRIPTION_TOO_LONG on >5000 chars', () => {
    expect(() => build({ description: 'x'.repeat(5001) })).toThrow(DomainException);
  });

  it('toggling completed=true sets completedAt to now', () => {
    const t = build();
    t.applyUpdate({ completed: true });
    expect(t.completed).toBe(true);
    expect(t.completedAt).not.toBeNull();
  });

  it('toggling completed=false clears completedAt', () => {
    const t = build({ completed: true, completedAt: new Date() });
    t.applyUpdate({ completed: false });
    expect(t.completed).toBe(false);
    expect(t.completedAt).toBeNull();
  });

  it('setting completed to the SAME value does not flip completedAt', () => {
    const original = new Date('2026-04-10T12:00:00.000Z');
    const t = build({ completed: true, completedAt: original });
    t.applyUpdate({ completed: true });
    expect(t.completedAt).toBe(original); // untouched
  });

  it('changing sectionId works', () => {
    const t = build();
    t.applyUpdate({ sectionId: 'sec-2' });
    expect(t.sectionId).toBe('sec-2');
  });
});
