import { type EntityManager } from 'typeorm';

import { type MonthlyServicePayment } from './monthly-service-payment.entity';

/**
 * Abstract repository for the v1.0.0 `monthly_service_payments` module.
 *
 * Mutating methods accept an optional `EntityManager` so the use case
 * can wrap the row save AND the currency-pool delta in a single
 * `dataSource.transaction()`.
 */
export abstract class MonthlyServicePaymentRepository {
  /**
   * Lists payments for a service in `period` desc order (most recent
   * first). Excludes soft-deleted rows.
   */
  abstract findByServiceId(monthlyServiceId: string): Promise<MonthlyServicePayment[]>;

  abstract findById(id: string): Promise<MonthlyServicePayment | null>;

  /**
   * Used by the create use case to enforce the
   * `(monthlyServiceId, period)` uniqueness invariant BEFORE attempting
   * to write — so a clean `MONTHLY_SERVICE_PAYMENT_ALREADY_EXISTS_FOR_PERIOD`
   * surfaces instead of a Postgres unique-constraint violation.
   */
  abstract findByServiceAndPeriod(
    monthlyServiceId: string,
    period: string,
  ): Promise<MonthlyServicePayment | null>;

  abstract save(
    payment: MonthlyServicePayment,
    manager?: EntityManager,
  ): Promise<MonthlyServicePayment>;

  abstract softDelete(id: string, manager?: EntityManager): Promise<void>;
}
