import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { MonthlyServiceRepository } from '@modules/monthly-services/domain/monthly-service.repository';

import { MonthlyServicePaymentRepository } from '../../domain/monthly-service-payment.repository';

import type { MonthlyServicePayment } from '../../domain/monthly-service-payment.entity';

@Injectable()
export class ListMonthlyServicePaymentsUseCase {
  constructor(
    private readonly repo: MonthlyServicePaymentRepository,
    private readonly serviceRepo: MonthlyServiceRepository,
  ) {}

  async execute(userId: string, monthlyServiceId: string): Promise<MonthlyServicePayment[]> {
    // Validate the service exists and belongs to the user BEFORE
    // listing its payments — defense against probing by id.
    const service = await this.serviceRepo.findById(monthlyServiceId);
    if (!service || service.deletedAt) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }
    if (service.userId !== userId) {
      throw new DomainException(
        'MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER',
        'No tenés acceso a este servicio',
      );
    }
    return this.repo.findByServiceId(monthlyServiceId);
  }
}
