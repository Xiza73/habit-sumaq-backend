import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { MonthlyServicePaymentRepository } from '@modules/monthly-service-payments/domain/monthly-service-payment.repository';

import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';

/**
 * Soft-deletes a monthly service — but only if it has no recorded payments.
 * Services that already produced payments must be archived instead (so the
 * ledger keeps a meaningful link to the service that originated each payment).
 *
 * v1.0.0 (Phase A6-B): the "has payments" guard now queries the
 * `monthly_service_payments` module (the new dedicated table). The legacy
 * `transactions.countByMonthlyServiceId` path is gone.
 */
@Injectable()
export class DeleteMonthlyServiceUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly paymentRepo: MonthlyServicePaymentRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const service = await this.serviceRepo.findById(id);
    if (!service || service.userId !== userId) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }

    const payments = await this.paymentRepo.findByServiceId(id);
    if (payments.length > 0) {
      throw new DomainException(
        'MONTHLY_SERVICE_HAS_PAYMENTS',
        'No se puede eliminar un servicio con pagos registrados. Archivalo en su lugar.',
      );
    }

    await this.serviceRepo.softDelete(id);
  }
}
