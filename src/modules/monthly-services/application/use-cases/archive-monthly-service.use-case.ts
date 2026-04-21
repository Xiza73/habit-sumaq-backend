import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';

/**
 * Toggles the service between active (visible in the default list) and
 * archived. Archiving a service does NOT delete linked transactions — those
 * stay in the ledger because they still affect account balances.
 */
@Injectable()
export class ArchiveMonthlyServiceUseCase {
  constructor(private readonly serviceRepo: MonthlyServiceRepository) {}

  async execute(id: string, userId: string): Promise<MonthlyService> {
    const service = await this.serviceRepo.findById(id);
    if (!service || service.userId !== userId) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }

    service.toggleActive();
    return this.serviceRepo.save(service);
  }
}
