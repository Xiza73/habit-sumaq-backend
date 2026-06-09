import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { MonthlyServicePaymentRepository } from '../../domain/monthly-service-payment.repository';

import type { MonthlyServicePayment } from '../../domain/monthly-service-payment.entity';

@Injectable()
export class GetMonthlyServicePaymentUseCase {
  constructor(private readonly repo: MonthlyServicePaymentRepository) {}

  async execute(id: string, userId: string): Promise<MonthlyServicePayment> {
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
    return payment;
  }
}
