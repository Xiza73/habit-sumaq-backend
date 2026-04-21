import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';

@Injectable()
export class GetMonthlyServiceUseCase {
  constructor(private readonly serviceRepo: MonthlyServiceRepository) {}

  async execute(id: string, userId: string): Promise<MonthlyService> {
    const service = await this.serviceRepo.findById(id);
    if (!service) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }
    if (service.userId !== userId) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }
    return service;
  }
}
