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
   * Re-fetches the chore THROUGH the transactional `manager` while holding a
   * `pessimistic_write` row lock (`SELECT ... FOR UPDATE`). Soft-deleted rows
   * are excluded. Used by the revert flow to serialize concurrent/duplicate
   * reverts on the same chore: the second caller blocks until the first
   * commits, then reads the already-updated state — mirroring how the
   * debts-loans `findPendingByReferenceCurrencyType` locks its rows and how
   * `CurrencyPoolService` locks the pool row. `manager` MUST be the
   * transactional EntityManager for the lock to be scoped to that transaction.
   */
  abstract findByIdForUpdate(id: string, manager: EntityManager): Promise<Chore | null>;

  /**
   * Persists the chore. Accepts an optional `manager` so callers can enroll
   * the save into an existing `dataSource.transaction()` (e.g. the revert flow
   * that soft-deletes a log and saves the chore atomically).
   */
  abstract save(chore: Chore, manager?: EntityManager): Promise<Chore>;

  /** Soft-deletes by id (sets deletedAt=now). Used after the no-logs guard. */
  abstract softDelete(id: string): Promise<void>;
}
