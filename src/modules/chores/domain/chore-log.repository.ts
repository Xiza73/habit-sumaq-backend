import type { ChoreLog } from './chore-log.entity';
import type { EntityManager } from 'typeorm';

export abstract class ChoreLogRepository {
  /**
   * Returns paginated logs for a chore, sorted by `doneAt DESC, createdAt DESC`
   * (newest first). Soft-deleted logs are excluded. `total` counts only the
   * non-deleted logs — the controller wraps both into the standard
   * `ApiResponse<T>` paging meta.
   */
  abstract findByChoreId(
    choreId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: ChoreLog[]; total: number }>;

  abstract countByChoreId(choreId: string): Promise<number>;

  /**
   * Returns the most recent non-deleted log for the chore (`doneAt DESC,
   * createdAt DESC`), or `null` if none. Accepts an optional `manager` so the
   * revert use case can re-query inside its transaction and see the row it
   * just soft-deleted as excluded.
   */
  abstract findLatestByChoreId(choreId: string, manager?: EntityManager): Promise<ChoreLog | null>;

  abstract save(log: ChoreLog): Promise<ChoreLog>;

  /** Soft-deletes a log by id (sets `deletedAt=now`). */
  abstract softDelete(id: string, manager?: EntityManager): Promise<void>;
}
