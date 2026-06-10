import { type EntityManager } from 'typeorm';

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

  /**
   * `manager` is optional — pass the one from a `dataSource.transaction(...)`
   * to atomically save the service alongside other rows (e.g. the MSP create
   * use case syncs the service entity together with the payment + pool delta).
   */
  abstract save(service: MonthlyService, manager?: EntityManager): Promise<MonthlyService>;

  /**
   * Soft-deletes by id (marks deletedAt=now). Used only after validating there
   * are no linked transactions.
   */
  abstract softDelete(id: string): Promise<void>;
}
