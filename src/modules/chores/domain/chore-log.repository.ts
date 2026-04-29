import type { ChoreLog } from './chore-log.entity';

export abstract class ChoreLogRepository {
  /**
   * Returns paginated logs for a chore, sorted by `doneAt DESC, createdAt DESC`
   * (newest first). `total` is the unfiltered count for the chore — the
   * controller wraps both into the standard `ApiResponse<T>` paging meta.
   */
  abstract findByChoreId(
    choreId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: ChoreLog[]; total: number }>;

  abstract countByChoreId(choreId: string): Promise<number>;

  abstract save(log: ChoreLog): Promise<ChoreLog>;
}
