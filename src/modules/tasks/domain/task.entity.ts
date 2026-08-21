import { DomainException } from '@common/exceptions/domain.exception';

import { TaskStatus } from './enums/task-status.enum';

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 5000;

/**
 * A single TODO inside a Section.
 *
 * `position` is scoped per-section — drag-and-drop in the UI is restricted to
 * within the same section. Cross-section moves happen via the edit form
 * (changing `sectionId`), at which point `position` is reset to "end of new
 * section" by the use case.
 *
 * Cleanup: DONE tasks (`completedAt < startOfWeekInUserTz`) are hard-deleted
 * lazily on `GET /tasks` at the start of each week (in the user's timezone,
 * respecting the `startOfWeek` setting). PENDING and IN_REVIEW tasks survive
 * across week boundaries — a task you are still verifying must not evaporate
 * mid-check.
 */
export class Task {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public sectionId: string,
    public title: string,
    public description: string | null,
    public status: TaskStatus,
    /**
     * When the task reached DONE. Null in every other state, including
     * IN_REVIEW — it is what the weekly cleanup measures against, so setting
     * it early would make an unfinished task sweepable.
     */
    public completedAt: Date | null,
    public position: number,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    Task.assertTitle(title);
    Task.assertDescription(description);
  }

  static assertTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new DomainException('TASK_TITLE_REQUIRED', 'El título es obligatorio');
    }
    if (title.length > MAX_TITLE_LENGTH) {
      throw new DomainException(
        'TASK_TITLE_TOO_LONG',
        `El título no puede superar ${MAX_TITLE_LENGTH} caracteres`,
      );
    }
  }

  static assertDescription(description: string | null): void {
    if (description !== null && description.length > MAX_DESCRIPTION_LENGTH) {
      throw new DomainException(
        'TASK_DESCRIPTION_TOO_LONG',
        `La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres`,
      );
    }
  }

  /** True only for DONE. Kept as a derived read for callers that just need it. */
  get isDone(): boolean {
    return this.status === TaskStatus.DONE;
  }

  applyUpdate(partial: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    sectionId?: string;
    position?: number;
  }): void {
    if (partial.title !== undefined) {
      Task.assertTitle(partial.title);
      this.title = partial.title;
    }
    if (partial.description !== undefined) {
      Task.assertDescription(partial.description);
      this.description = partial.description;
    }
    if (partial.status !== undefined && partial.status !== this.status) {
      this.status = partial.status;
      // Stamped on entering DONE and cleared on leaving it — including on the
      // way back to IN_REVIEW, so a task pulled out of done stops being
      // eligible for the weekly sweep.
      this.completedAt = partial.status === TaskStatus.DONE ? new Date() : null;
    }
    if (partial.sectionId !== undefined) {
      this.sectionId = partial.sectionId;
    }
    if (partial.position !== undefined) {
      this.position = partial.position;
    }
    this.updatedAt = new Date();
  }
}
