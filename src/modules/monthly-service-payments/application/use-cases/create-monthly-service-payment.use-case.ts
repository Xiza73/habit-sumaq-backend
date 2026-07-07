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
 * Syncing the service only needs the single most-recent payment: its amount
 * becomes `estimatedAmount` and its calendar day becomes `dueDay`.
 */
const RECENT_PAYMENTS_TO_FETCH = 1;

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
 *      doesn't regress the pointer), and set `estimatedAmount`
 *      + `dueDay` from the most-recent payment (including the one just
 *      saved — the repo reads through the same manager so the
 *      uncommitted row is visible).
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
 * Why `timezone` is here: `dueDay` is "day-of-month of the most recent
 * payment in the user's local zone". The controller injects it from
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
   * and sets both `estimatedAmount` and `dueDay` from the MOST RECENT
   * payment — the amount for the estimate, the calendar day for the due day.
   *
   * The repo reads through the same `manager` so the row just persisted
   * (uncommitted) is visible when picking the most recent payment.
   *
   * History — `estimatedAmount` and `dueDay` used to be moving averages
   * across the last N payments. In practice users found it counterintuitive:
   * a single off month would tug both values for several cycles. The user
   * prefers "what I last paid, the day I last paid" — direct, no smoothing.
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
    const recent = await this.repo.findLastNByServiceId(
      service.id,
      RECENT_PAYMENTS_TO_FETCH,
      manager,
    );
    if (recent.length > 0) {
      // `findLastNByServiceId` returns rows ordered by (period DESC, date DESC),
      // so recent[0] IS the most recent payment — including the one just saved.
      const mostRecent = recent[0];
      service.estimatedAmount = mostRecent.amount;
      service.dueDay = clampDayOfMonth(dayInTimezone(mostRecent.date, timezone));
    }
    await this.serviceRepo.save(service, manager);
  }
}

/**
 * Clamp to the column's validation range (1..31). Handles edge cases like
 * an empty timezone string falling through to a UTC day of 0.
 */
function clampDayOfMonth(day: number): number {
  return Math.min(31, Math.max(1, day));
}
