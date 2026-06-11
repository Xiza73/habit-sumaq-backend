import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { MonthlyServicePayment } from '../../domain/monthly-service-payment.entity';
import { MonthlyServicePaymentRepository } from '../../domain/monthly-service-payment.repository';

import type { UpdateMonthlyServicePaymentDto } from '../dto/update-monthly-service-payment.dto';

/**
 * PATCH /monthly-service-payments/:id.
 *
 * `monthlyServiceId`, `currency`, and `period` are immutable — the
 * DTO doesn't even expose them.
 *
 * Atomicity:
 *   - If `amount` changes, applies `(oldAmount - newAmount)` to the
 *     pool inside `dataSource.transaction()` (same pattern as
 *     budget-movements update).
 *   - If only metadata changes (description, date), skips the tx
 *     wrapper — saves a roundtrip.
 */
@Injectable()
export class UpdateMonthlyServicePaymentUseCase {
  constructor(
    private readonly repo: MonthlyServicePaymentRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(UpdateMonthlyServicePaymentUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    id: string,
    userId: string,
    dto: UpdateMonthlyServicePaymentDto,
  ): Promise<MonthlyServicePayment> {
    const payment = await this.repo.findById(id);
    if (!payment || payment.isDeleted()) {
      throw new DomainException('MONTHLY_SERVICE_PAYMENT_NOT_FOUND', 'Pago no encontrado');
    }
    if (payment.userId !== userId) {
      throw new DomainException(
        'MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER',
        'No tenés acceso a este pago',
      );
    }

    const oldAmount = payment.amount;
    payment.update({
      amount: dto.amount,
      description: dto.description,
      date: dto.date ? new Date(dto.date) : undefined,
    });

    const amountDelta = dto.amount !== undefined ? oldAmount - payment.amount : 0;

    if (amountDelta === 0) {
      // Pure metadata update — skip the tx wrapper.
      const saved = await this.repo.save(payment);
      this.logger.info(
        {
          event: 'monthly_service_payment.updated',
          monthlyServicePaymentId: saved.id,
          userId,
          amountChanged: false,
        },
        'monthly_service_payment.updated',
      );
      return saved;
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const persisted = await this.repo.save(payment, manager);
      await this.poolService.applyDelta(userId, payment.currency, amountDelta, manager);
      return persisted;
    });

    this.logger.info(
      {
        event: 'monthly_service_payment.updated',
        monthlyServicePaymentId: saved.id,
        userId,
        amountChanged: true,
        oldAmount,
        newAmount: saved.amount,
        poolDelta: amountDelta,
      },
      'monthly_service_payment.updated',
    );

    return saved;
  }
}
