import { DomainException } from '@common/exceptions/domain.exception';

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 5000;

export class QuickTask {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public title: string,
    public description: string | null,
    public completed: boolean,
    public completedAt: Date | null,
    public position: number,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    QuickTask.assertTitle(title);
    QuickTask.assertDescription(description);
  }

  static assertTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new DomainException('QUICK_TASK_TITLE_REQUIRED', 'El título es obligatorio');
    }
    if (title.length > MAX_TITLE_LENGTH) {
      throw new DomainException(
        'QUICK_TASK_TITLE_TOO_LONG',
        `El título no puede superar ${MAX_TITLE_LENGTH} caracteres`,
      );
    }
  }

  static assertDescription(description: string | null): void {
    if (description !== null && description.length > MAX_DESCRIPTION_LENGTH) {
      throw new DomainException(
        'QUICK_TASK_DESCRIPTION_TOO_LONG',
        `La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres`,
      );
    }
  }

  applyUpdate(partial: {
    title?: string;
    description?: string | null;
    completed?: boolean;
    position?: number;
  }): void {
    if (partial.title !== undefined) {
      QuickTask.assertTitle(partial.title);
      this.title = partial.title;
    }
    if (partial.description !== undefined) {
      QuickTask.assertDescription(partial.description);
      this.description = partial.description;
    }
    if (partial.completed !== undefined && partial.completed !== this.completed) {
      this.completed = partial.completed;
      this.completedAt = partial.completed ? new Date() : null;
    }
    if (partial.position !== undefined) {
      this.position = partial.position;
    }
    this.updatedAt = new Date();
  }
}
