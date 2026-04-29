import type { Chore } from './chore.entity';

export abstract class ChoreRepository {
  /**
   * List chores owned by `userId`. Archived ones (isActive=false) are
   * included only when `includeArchived=true`. Soft-deleted rows are
   * filtered out by TypeORM via @DeleteDateColumn.
   */
  abstract findByUserId(userId: string, includeArchived?: boolean): Promise<Chore[]>;

  abstract findById(id: string): Promise<Chore | null>;

  abstract save(chore: Chore): Promise<Chore>;

  /** Soft-deletes by id (sets deletedAt=now). Used after the no-logs guard. */
  abstract softDelete(id: string): Promise<void>;
}
