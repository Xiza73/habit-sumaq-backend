import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { type Currency } from '@common/enums/currency.enum';
import { DomainException } from '@common/exceptions/domain.exception';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';
import { MonthlyServiceRepository } from '@modules/monthly-services/domain/monthly-service.repository';

import {
  isValidPeriodFormat,
  MonthlyServicePayment,
} from '../../domain/monthly-service-payment.entity';
import { MonthlyServicePaymentRepository } from '../../domain/monthly-service-payment.repository';

import type { CreateMonthlyServicePaymentDto } from '../dto/create-monthly-service-payment.dto';

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
 * Atomicity:
 *   - `dataSource.transaction()` wraps the row save and
 *     `pool.applyDelta(userId, currency, -amount)`. If either step
 *     fails, neither persists.
 *
 * Currency is inherited from the service — never read from the DTO.
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
      },
      'monthly_service_payment.created',
    );

    return saved;
  }
}
