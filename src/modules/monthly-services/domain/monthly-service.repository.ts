import type { MonthlyService } from './monthly-service.entity';

export abstract class MonthlyServiceRepository {
  /** List services owned by `userId`. Archived ones (isActive=false) are included only when `includeArchived=true`. */
  abstract findByUserId(userId: string, includeArchived?: boolean): Promise<MonthlyService[]>;

  abstract findById(id: string): Promise<MonthlyService | null>;

  /**
   * Finds an active service for this user with a matching name (case-sensitive
   * exact match — the DB unique index is not normalized). Used before create/
   * update to detect duplicate names before hitting the DB constraint.
   */
  abstract findActiveByUserIdAndName(userId: string, name: string): Promise<MonthlyService | null>;

  abstract save(service: MonthlyService): Promise<MonthlyService>;

  /**
   * Soft-deletes by id (marks deletedAt=now). Used only after validating there
   * are no linked transactions.
   */
  abstract softDelete(id: string): Promise<void>;
}
