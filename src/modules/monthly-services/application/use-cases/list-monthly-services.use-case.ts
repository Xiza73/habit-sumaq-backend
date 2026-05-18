import { Injectable } from '@nestjs/common';

import { TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';

/**
 * What a list-monthly-services call returns to the caller. The `service`
 * is the domain entity; `paidAmountForCurrentMonth` is the **sum of EXPENSE
 * transactions linked to the service in the user's current calendar month**
 * — computed in the user's timezone via the transaction repo aggregate.
 *
 * This drives the per-currency "Pagado / Estimado" KPI on the services
 * dashboard. We compute it here (and not on every endpoint that emits a
 * service DTO) because only the list view actually surfaces it — keeping the
 * extra SQL round-trip scoped to the one place that needs it.
 */
export interface MonthlyServiceWithPaidAmount {
  service: MonthlyService;
  paidAmountForCurrentMonth: number;
}

@Injectable()
export class ListMonthlyServicesUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly txRepo: TransactionRepository,
  ) {}

  async execute(
    userId: string,
    includeArchived: boolean,
    currentPeriod: string,
    timezone: string,
  ): Promise<MonthlyServiceWithPaidAmount[]> {
    const services = await this.serviceRepo.findByUserId(userId, includeArchived);
    if (services.length === 0) return [];

    const paidByService = await this.txRepo.sumAmountByMonthlyServiceIdsInPeriod(
      services.map((s) => s.id),
      currentPeriod,
      timezone,
    );

    return services.map((service) => ({
      service,
      // Services with no payments in the current period are absent from the
      // map — treat them as 0 rather than null so the DTO field stays a plain
      // `number` and the frontend can sum without nullish guards.
      paidAmountForCurrentMonth: paidByService.get(service.id) ?? 0,
    }));
  }
}
