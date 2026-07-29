import { Injectable } from '@nestjs/common';

import { MonthlyServicePaymentRepository } from '@modules/monthly-service-payments/domain/monthly-service-payment.repository';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { LinkedDebtsGatherer, type LinkedDebtSummary } from '../services/linked-debts-gatherer';

/**
 * What a list-monthly-services call returns to the caller. The `service`
 * is the domain entity; `paidAmountForCurrentMonth` is the **sum of active
 * payments for the service whose `period` matches the user's current
 * calendar month** — pulled from the v1.0.0 `monthly_service_payments`
 * table.
 *
 * This drives the per-currency "Pagado / Estimado" KPI on the services
 * dashboard. We compute it here (and not on every endpoint that emits a
 * service DTO) because only the list view actually surfaces it — keeping
 * the extra SQL round-trip scoped to the one place that needs it.
 *
 * v1.0.0 (`accounts-to-modular-finance` refactor): the aggregate now comes
 * from `monthly_service_payments` instead of legacy `transactions`. The
 * MSP table stores `period` as a literal `YYYY-MM` column, so the
 * timezone/AT-TIME-ZONE math the legacy repo needed goes away.
 */
export interface MonthlyServiceWithPaidAmount {
  service: MonthlyService;
  paidAmountForCurrentMonth: number;
  linkedDebts: LinkedDebtSummary[];
}

@Injectable()
export class ListMonthlyServicesUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly paymentRepo: MonthlyServicePaymentRepository,
    private readonly linkedDebtsGatherer: LinkedDebtsGatherer,
  ) {}

  async execute(
    userId: string,
    includeArchived: boolean,
    currentPeriod: string,
    // `timezone` is no longer needed — the MSP repo aggregates by literal
    // `period` column, not by `date AT TIME ZONE`. We keep the parameter
    // in the signature for now so the controller doesn't need to change;
    // the parameter is a no-op and will be dropped in A6-B together with
    // the rest of the legacy plumbing.
    _timezone: string,
  ): Promise<MonthlyServiceWithPaidAmount[]> {
    const services = await this.serviceRepo.findByUserId(userId, includeArchived);
    if (services.length === 0) return [];

    const paidByService = await this.paymentRepo.sumByServiceIdsInPeriod(
      services.map((s) => s.id),
      currentPeriod,
    );

    return Promise.all(
      services.map(async (service) => ({
        service,
        // Services with no payments in the current period are absent from the
        // map — treat them as 0 rather than null so the DTO field stays a plain
        // `number` and the frontend can sum without nullish guards.
        paidAmountForCurrentMonth: paidByService.get(service.id) ?? 0,
        linkedDebts: await this.linkedDebtsGatherer.forService(service.id),
      })),
    );
  }
}
