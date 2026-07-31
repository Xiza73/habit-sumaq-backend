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

  /**
   * Batched sibling of {@link findByServiceId}: lists active payments for
   * ALL of `monthlyServiceIds` in a single query. Used by
   * `LinkedDebtsGatherer.forServices` to avoid an N+1 fan-out when the
   * monthly-services list endpoint resolves `linkedDebts[]` for many
   * services at once. Excludes soft-deleted rows. Returns a flat list —
   * the caller groups back to `monthlyServiceId` via the entity field.
   */
  abstract findByServiceIds(monthlyServiceIds: string[]): Promise<MonthlyServicePayment[]>;

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

  /**
   * Sum of `amount` per currency for payments whose `date` falls in
   * `[from, to)`. Used by the finances-dashboard `periodFlow` widget.
   * Filters out soft-deleted rows. Half-open range, same convention
   * as the budget-movements counterpart.
   */
  abstract sumByCurrencyInRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ currency: string; total: number }>>;

  /**
   * Per-day per-currency expense timeline over `[from, to)`. Used by
   * the finances-dashboard `dailyFlow` widget. Same shape as the
   * budget-movements counterpart so the use case can merge them with
   * a single map.
   */
  abstract dailyByCurrencyInRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ date: string; currency: string; total: number }>>;

  /**
   * Returns the most recent N active payments for `monthlyServiceId`,
   * ordered by `period` desc, then `date` desc. Used by the create-payment
   * use case to recompute `service.estimatedAmount` and `service.dueDay`
   * as a moving average over the most recent N payments. Excludes
   * soft-deleted rows. Same convention as the legacy
   * `txRepo.findLastNByMonthlyServiceId`.
   */
  abstract findLastNByServiceId(
    monthlyServiceId: string,
    limit: number,
    manager?: EntityManager,
  ): Promise<MonthlyServicePayment[]>;

  /**
   * Sum of `amount` per service for active payments in `period` (YYYY-MM).
   * Returns a `Map<serviceId, total>` — services with no payment in the
   * period are absent from the map (callers treat as 0). Used by the
   * monthly-services list KPI ("Pagado / Estimado" per currency).
   *
   * v1.0.0 simplification: `monthly_service_payments` stores `period`
   * as a literal `YYYY-MM` column, so no timezone math is needed (unlike
   * the legacy txRepo counterpart that had to bucket on `date AT TIME ZONE`).
   */
  abstract sumByServiceIdsInPeriod(
    monthlyServiceIds: string[],
    period: string,
  ): Promise<Map<string, number>>;

  abstract save(
    payment: MonthlyServicePayment,
    manager?: EntityManager,
  ): Promise<MonthlyServicePayment>;

  abstract softDelete(id: string, manager?: EntityManager): Promise<void>;
}
