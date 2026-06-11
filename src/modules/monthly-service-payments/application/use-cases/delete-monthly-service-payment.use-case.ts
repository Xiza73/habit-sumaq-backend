import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { MonthlyServicePaymentRepository } from '../../domain/monthly-service-payment.repository';

/**
 * DELETE /monthly-service-payments/:id.
 *
 * Same shape as DELETE /budget-movements/:id — soft-delete + refund
 * the pool atomically. A monthly-service payment IS the recorded
 * expense; deleting it should reverse the pool debit.
 */
@Injectable()
export class DeleteMonthlyServicePaymentUseCase {
  constructor(
    private readonly repo: MonthlyServicePaymentRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(DeleteMonthlyServicePaymentUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
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

    await this.dataSource.transaction(async (manager) => {
      await this.repo.softDelete(id, manager);
      await this.poolService.applyDelta(userId, payment.currency, payment.amount, manager);
    });

    this.logger.info(
      {
        event: 'monthly_service_payment.deleted',
        monthlyServicePaymentId: id,
        userId,
        monthlyServiceId: payment.monthlyServiceId,
        period: payment.period,
        currency: payment.currency,
        refundAmount: payment.amount,
      },
      'monthly_service_payment.deleted',
    );
  }
}
