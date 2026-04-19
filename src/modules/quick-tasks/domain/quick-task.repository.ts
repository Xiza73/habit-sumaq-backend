import { type QuickTask } from './quick-task.entity';

export abstract class QuickTaskRepository {
  /** Returns all quick tasks for a user, ordered by position ASC then createdAt ASC. */
  abstract findByUserId(userId: string): Promise<QuickTask[]>;

  abstract findById(id: string): Promise<QuickTask | null>;

  abstract save(task: QuickTask): Promise<QuickTask>;

  /** Hard-deletes by id. */
  abstract deleteById(id: string): Promise<void>;

  /**
   * Hard-deletes every completed task belonging to `userId` whose
   * `completedAt` is strictly before `before`. Returns the number of rows
   * removed (used by lazy cleanup on GET).
   */
  abstract deleteCompletedBefore(userId: string, before: Date): Promise<number>;

  /**
   * Max `position` currently stored for the user, or `null` if the user has
   * no tasks. Used to append new tasks at the end without a full scan.
   */
  abstract maxPositionByUserId(userId: string): Promise<number | null>;

  /**
   * Persists a batch position update in a single round-trip. Each pair is
   * `{ id, position }`. Records not listed are left untouched.
   */
  abstract updatePositions(
    userId: string,
    updates: { id: string; position: number }[],
  ): Promise<void>;
}
