import type { Chore } from './chore.entity';
import type { EntityManager } from 'typeorm';

export abstract class ChoreRepository {
  /**
   * List chores owned by `userId`. Archived ones (isActive=false) are
   * included only when `includeArchived=true`. Soft-deleted rows are
   * filtered out by TypeORM via @DeleteDateColumn.
   */
  abstract findByUserId(userId: string, includeArchived?: boolean): Promise<Chore[]>;

  abstract findById(id: string): Promise<Chore | null>;

  /**
   * Persists the chore. Accepts an optional `manager` so callers can enroll
   * the save into an existing `dataSource.transaction()` (e.g. the revert flow
   * that soft-deletes a log and saves the chore atomically).
   */
  abstract save(chore: Chore, manager?: EntityManager): Promise<Chore>;

  /** Soft-deletes by id (sets deletedAt=now). Used after the no-logs guard. */
  abstract softDelete(id: string): Promise<void>;
}
