import type { Section } from './section.entity';

export abstract class SectionRepository {
  /** Sections owned by `userId`, ordered by position ASC, then createdAt ASC. */
  abstract findByUserId(userId: string): Promise<Section[]>;

  abstract findById(id: string): Promise<Section | null>;

  abstract save(section: Section): Promise<Section>;

  /**
   * Hard-deletes a section AND every task inside it. The DB FK has
   * `ON DELETE CASCADE` so the task rows go in the same statement.
   */
  abstract deleteById(id: string): Promise<void>;

  /** Max `position` for the user — used to append new sections at the end. */
  abstract maxPositionByUserId(userId: string): Promise<number | null>;

  /** Bulk position update for reorder (single round-trip). */
  abstract updatePositions(
    userId: string,
    updates: { id: string; position: number }[],
  ): Promise<void>;
}
