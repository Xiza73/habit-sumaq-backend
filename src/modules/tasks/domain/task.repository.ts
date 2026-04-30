import type { Task } from './task.entity';

export abstract class TaskRepository {
  /** Tasks owned by `userId`, ordered by section position ASC then task position ASC. */
  abstract findByUserId(userId: string): Promise<Task[]>;

  abstract findById(id: string): Promise<Task | null>;

  /** Tasks belonging to a section — used by reorder validation. */
  abstract findBySectionId(sectionId: string): Promise<Task[]>;

  abstract save(task: Task): Promise<Task>;

  /** Hard-deletes a task by id. */
  abstract deleteById(id: string): Promise<void>;

  /**
   * Hard-deletes every completed task belonging to `userId` whose
   * `completedAt` is strictly before `before`. Returns the number of rows
   * deleted (logged by the lazy weekly cleanup on GET).
   */
  abstract deleteCompletedBefore(userId: string, before: Date): Promise<number>;

  /** Max `position` within a section — used to append new tasks at the end. */
  abstract maxPositionInSection(sectionId: string): Promise<number | null>;

  /** Bulk position update within a single section. */
  abstract updatePositions(updates: { id: string; position: number }[]): Promise<void>;
}
