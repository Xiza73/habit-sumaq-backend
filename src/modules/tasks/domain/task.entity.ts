import { DomainException } from '@common/exceptions/domain.exception';

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
 * Cleanup: completed tasks (`completedAt < startOfWeekInUserTz`) are
 * hard-deleted lazily on `GET /tasks` at the start of each week (in the
 * user's timezone, respecting the `startOfWeek` setting). Incomplete tasks
 * survive across week boundaries.
 */
export class Task {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public sectionId: string,
    public title: string,
    public description: string | null,
    public completed: boolean,
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

  applyUpdate(partial: {
    title?: string;
    description?: string | null;
    completed?: boolean;
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
    if (partial.completed !== undefined && partial.completed !== this.completed) {
      this.completed = partial.completed;
      this.completedAt = partial.completed ? new Date() : null;
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
