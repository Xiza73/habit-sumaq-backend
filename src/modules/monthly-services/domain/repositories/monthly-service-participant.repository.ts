import { type EntityManager } from 'typeorm';

import type { MonthlyServiceParticipant } from '../entities/monthly-service-participant.entity';

/**
 * Repository abstract for the shared-service participant config
 * (`monthly_service_participants`). Slice 1: CRUD only — no linking to
 * `debts_loans` yet (that arrives with payment generation in a later
 * slice).
 */
export abstract class MonthlyServiceParticipantRepository {
  /** List active (non-soft-deleted) participants configured for a service. */
  abstract findByServiceId(monthlyServiceId: string): Promise<MonthlyServiceParticipant[]>;

  /**
   * Find the active participant matching a normalized reference within a
   * service — used before insert/update to translate the DB partial
   * unique-index violation into a clean domain error
   * (`MSP_PARTICIPANT_DUPLICATE_REFERENCE`).
   */
  abstract findByNormalizedReference(
    monthlyServiceId: string,
    normalizedReference: string,
  ): Promise<MonthlyServiceParticipant | null>;

  /**
   * `manager` is optional — pass one when the caller wraps the save inside
   * a broader transaction. Slice 1 CRUD use cases call this without a
   * manager (single-row writes with no other side effects).
   */
  abstract save(
    participant: MonthlyServiceParticipant,
    manager?: EntityManager,
  ): Promise<MonthlyServiceParticipant>;

  abstract softDelete(id: string, manager?: EntityManager): Promise<void>;
}
