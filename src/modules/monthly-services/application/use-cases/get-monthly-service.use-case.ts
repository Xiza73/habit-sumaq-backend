import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { LinkedDebtsGatherer, type LinkedDebtSummary } from '../services/linked-debts-gatherer';

export interface MonthlyServiceWithLinkedDebts {
  service: MonthlyService;
  linkedDebts: LinkedDebtSummary[];
}

@Injectable()
export class GetMonthlyServiceUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly linkedDebtsGatherer: LinkedDebtsGatherer,
  ) {}

  async execute(id: string, userId: string): Promise<MonthlyServiceWithLinkedDebts> {
    const service = await this.serviceRepo.findById(id);
    if (!service) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }
    if (service.userId !== userId) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }
    const linkedDebts = await this.linkedDebtsGatherer.forService(service.id);
    return { service, linkedDebts };
  }
}
