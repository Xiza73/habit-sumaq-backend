import { DomainException } from '@common/exceptions/domain.exception';

import { TaskStatus } from './enums/task-status.enum';
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
      overrides.status ?? TaskStatus.PENDING,
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

  it('entering DONE stamps completedAt', () => {
    const t = build();
    t.applyUpdate({ status: TaskStatus.DONE });
    expect(t.status).toBe(TaskStatus.DONE);
    expect(t.completedAt).not.toBeNull();
  });

  it('does NOT stamp completedAt on IN_REVIEW', () => {
    // completedAt is what the weekly cleanup measures against. Stamping it
    // while the task is still being verified would make it sweepable, which
    // is the exact failure the third state exists to prevent.
    const t = build();
    t.applyUpdate({ status: TaskStatus.IN_REVIEW });

    expect(t.status).toBe(TaskStatus.IN_REVIEW);
    expect(t.completedAt).toBeNull();
    expect(t.isDone).toBe(false);
  });

  it('clears completedAt when pulled from DONE back to IN_REVIEW', () => {
    const t = build({ status: TaskStatus.DONE, completedAt: new Date() });
    t.applyUpdate({ status: TaskStatus.IN_REVIEW });

    expect(t.completedAt).toBeNull();
  });

  it('leaving DONE clears completedAt', () => {
    const t = build({ status: TaskStatus.DONE, completedAt: new Date() });
    t.applyUpdate({ status: TaskStatus.PENDING });
    expect(t.status).toBe(TaskStatus.PENDING);
    expect(t.completedAt).toBeNull();
  });

  it('setting completed to the SAME value does not flip completedAt', () => {
    const original = new Date('2026-04-10T12:00:00.000Z');
    const t = build({ status: TaskStatus.DONE, completedAt: original });
    t.applyUpdate({ status: TaskStatus.DONE });
    expect(t.completedAt).toBe(original); // untouched
  });

  it('changing sectionId works', () => {
    const t = build();
    t.applyUpdate({ sectionId: 'sec-2' });
    expect(t.sectionId).toBe('sec-2');
  });
});
