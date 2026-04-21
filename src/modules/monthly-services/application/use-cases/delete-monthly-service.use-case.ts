import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';

/**
 * Soft-deletes a monthly service — but only if it has no linked transactions.
 * Services that already produced payments must be archived instead (so the
 * ledger keeps a meaningful link to the service that originated each payment).
 */
@Injectable()
export class DeleteMonthlyServiceUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly txRepo: TransactionRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const service = await this.serviceRepo.findById(id);
    if (!service || service.userId !== userId) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }

    const paymentCount = await this.txRepo.countByMonthlyServiceId(id);
    if (paymentCount > 0) {
      throw new DomainException(
        'MONTHLY_SERVICE_HAS_PAYMENTS',
        'No se puede eliminar un servicio con pagos registrados. Archivalo en su lugar.',
      );
    }

    await this.serviceRepo.softDelete(id);
  }
}
