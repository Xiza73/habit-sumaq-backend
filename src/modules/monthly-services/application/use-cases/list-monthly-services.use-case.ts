import { Injectable } from '@nestjs/common';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';

@Injectable()
export class ListMonthlyServicesUseCase {
  constructor(private readonly serviceRepo: MonthlyServiceRepository) {}

  async execute(userId: string, includeArchived: boolean): Promise<MonthlyService[]> {
    return this.serviceRepo.findByUserId(userId, includeArchived);
  }
}
