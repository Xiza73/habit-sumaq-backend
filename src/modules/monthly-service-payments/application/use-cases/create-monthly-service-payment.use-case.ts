import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource, type EntityManager } from 'typeorm';

import { type Currency } from '@common/enums/currency.enum';
import { DomainException } from '@common/exceptions/domain.exception';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';
import { type MonthlyService } from '@modules/monthly-services/domain/monthly-service.entity';
import { MonthlyServiceRepository } from '@modules/monthly-services/domain/monthly-service.repository';
import { dayInTimezone } from '@modules/monthly-services/infrastructure/timezone/day-in-timezone';

import {
  isValidPeriodFormat,
  MonthlyServicePayment,
} from '../../domain/monthly-service-payment.entity';
import { MonthlyServicePaymentRepository } from '../../domain/monthly-service-payment.repository';

import type { CreateMonthlyServicePaymentDto } from '../dto/create-monthly-service-payment.dto';

/**
 * Number of recent payments averaged when re-computing the service's
 * `estimatedAmount` and `dueDay`. Matches the legacy `PayMonthlyServiceUseCase`
 * window so user behavior doesn't change when migrating to v1.0.0.
 */
const MOVING_AVG_WINDOW = 3;

/**
 * POST /monthly-service-payments.
 *
 * Validations (in order):
 *   1. `period` must match `YYYY-MM` (defense in depth — the DTO's
 *      class-validator already catches this, but the use case
 *      re-validates so a direct call from another use case can't
 *      bypass it).
 *   2. Service exists, belongs to user, not deleted.
 *   3. No active payment exists for `(monthlyServiceId, period)` —
 *      enforced via `findByServiceAndPeriod` so a clean MSP_003
 *      surfaces (instead of the DB's unique-constraint violation).
 *
 * Atomicity (all-or-nothing inside `dataSource.transaction()`):
 *   1. Persist the payment row.
 *   2. Debit the user's currency pool by `amount`.
 *   3. **Sync the service entity** — advance `lastPaidPeriod` (only if
 *      the new period is later than the stored one, so back-paying
 *      doesn't regress the pointer), and recompute `estimatedAmount`
 *      + `dueDay` as the moving average over the most-recent N payments
 *      (including the one just saved — the repo reads through the same
 *      manager so the uncommitted row is visible).
 *
 *      WITHOUT step 3, the service stays "unpaid forever" from the
 *      monthly-services list endpoint's POV — `nextDuePeriod` keeps
 *      returning the stale period and the card never flips to
 *      "paid"/"overdue cleared". Same UX bug the legacy
 *      `PayMonthlyServiceUseCase` solved with `markPeriodAsPaid` +
 *      moving-average estimates.
 *
 * Currency is inherited from the service — never read from the DTO.
 *
 * Why `timezone` is here: `dueDay` is "average day-of-month of recent
 * payments in the user's local zone". The controller injects it from
 * the `x-timezone` header (same convention as the legacy pay endpoint).
 */
@Injectable()
export class CreateMonthlyServicePaymentUseCase {
  constructor(
    private readonly repo: MonthlyServicePaymentRepository,
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(CreateMonthlyServicePaymentUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    userId: string,
    dto: CreateMonthlyServicePaymentDto,
    timezone: string,
  ): Promise<MonthlyServicePayment> {
    if (!isValidPeriodFormat(dto.period)) {
      throw new DomainException(
        'MONTHLY_SERVICE_PAYMENT_INVALID_PERIOD_FORMAT',
        'El período debe tener formato YYYY-MM',
      );
    }

    const service = await this.serviceRepo.findById(dto.monthlyServiceId);
    if (!service || service.deletedAt) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }
    if (service.userId !== userId) {
      throw new DomainException(
        'MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER',
        'No tenés acceso a este servicio',
      );
    }

    const existing = await this.repo.findByServiceAndPeriod(dto.monthlyServiceId, dto.period);
    if (existing) {
      throw new DomainException(
        'MONTHLY_SERVICE_PAYMENT_ALREADY_EXISTS_FOR_PERIOD',
        `Ya existe un pago activo para ${dto.period}`,
      );
    }

    const now = new Date();
    const payment = new MonthlyServicePayment(
      randomUUID(),
      userId,
      service.id,
      service.currency as Currency,
      dto.amount,
      dto.period,
      dto.description ?? null,
      dto.date ? new Date(dto.date) : now,
      now,
      now,
      null,
    );

    const saved = await this.dataSource.transaction(async (manager) => {
      const persisted = await this.repo.save(payment, manager);
      await this.poolService.applyDelta(userId, service.currency as Currency, -dto.amount, manager);
      // Sync the service entity in the SAME tx so the list endpoint's
      // KPI / nextDuePeriod / isPaidForCurrentMonth reflect this payment
      // immediately on the next GET.
      await this.syncService(service, dto.period, timezone, manager);
      return persisted;
    });

    this.logger.info(
      {
        event: 'monthly_service_payment.created',
        monthlyServicePaymentId: saved.id,
        userId,
        monthlyServiceId: service.id,
        period: dto.period,
        currency: service.currency,
        amount: dto.amount,
        poolDelta: -dto.amount,
        lastPaidPeriodAdvancedTo: service.lastPaidPeriod,
      },
      'monthly_service_payment.created',
    );

    return saved;
  }

  /**
   * Mutates `service` and saves it via `manager`. Advances `lastPaidPeriod`
   * only forward (so back-paying an earlier period — e.g. discovering you
   * paid March but forgot to register it — doesn't regress the pointer),
   * re-averages `estimatedAmount` over the most recent N active payments,
   * and snaps `dueDay` to the calendar day of the MOST RECENT payment.
   *
   * The repo reads through the same `manager` so the row just persisted
   * (uncommitted) is visible to both the amount average and the day pick.
   *
   * History — `dueDay` used to be a moving average across the last N
   * payments. In practice users found it counterintuitive: a single late
   * payment would tug the predicted day for several cycles. The user
   * prefers "the day I last paid" — direct, no smoothing.
   */
  private async syncService(
    service: MonthlyService,
    paidPeriod: string,
    timezone: string,
    manager: EntityManager,
  ): Promise<void> {
    if (!service.lastPaidPeriod || paidPeriod > service.lastPaidPeriod) {
      service.markPeriodAsPaid(paidPeriod);
    }
    const recent = await this.repo.findLastNByServiceId(service.id, MOVING_AVG_WINDOW, manager);
    if (recent.length > 0) {
      service.estimatedAmount = computeAverageAmount(recent);
      // `findLastNByServiceId` returns rows ordered by (period DESC, date DESC),
      // so recent[0] IS the most recent payment — including the one just saved.
      service.dueDay = clampDayOfMonth(dayInTimezone(recent[0].date, timezone));
    }
    await this.serviceRepo.save(service, manager);
  }
}

function computeAverageAmount(payments: MonthlyServicePayment[]): number {
  if (payments.length === 0) return 0;
  const sum = payments.reduce((acc, p) => acc + p.amount, 0);
  return Math.round((sum / payments.length) * 100) / 100;
}

/**
 * Clamp to the column's validation range (1..31). Handles edge cases like
 * an empty timezone string falling through to a UTC day of 0.
 */
function clampDayOfMonth(day: number): number {
  return Math.min(31, Math.max(1, day));
}
