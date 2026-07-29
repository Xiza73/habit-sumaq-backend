import { type MonthlyServicePaymentRepository } from '@modules/monthly-service-payments/domain/monthly-service-payment.repository';
import { type LinkedDebtsGatherer } from '@modules/monthly-services/application/services/linked-debts-gatherer';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { ListMonthlyServicesUseCase } from './list-monthly-services.use-case';

describe('ListMonthlyServicesUseCase', () => {
  let useCase: ListMonthlyServicesUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let paymentRepo: jest.Mocked<MonthlyServicePaymentRepository>;
  let linkedDebtsGatherer: jest.Mocked<Pick<LinkedDebtsGatherer, 'forService'>>;

  const currentPeriod = '2026-05';
  const timezone = 'America/Lima';

  beforeEach(() => {
    serviceRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    // Only `sumByServiceIdsInPeriod` is touched by this use case — the rest
    // are stubbed to satisfy the `jest.Mocked<MonthlyServicePaymentRepository>`
    // shape without expanding the surface area under test.
    paymentRepo = {
      findByServiceId: jest.fn(),
      findById: jest.fn(),
      findByServiceAndPeriod: jest.fn(),
      sumByCurrencyInRange: jest.fn(),
      dailyByCurrencyInRange: jest.fn(),
      findLastNByServiceId: jest.fn(),
      sumByServiceIdsInPeriod: jest.fn().mockResolvedValue(new Map<string, number>()),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    linkedDebtsGatherer = { forService: jest.fn().mockResolvedValue([]) };

    useCase = new ListMonthlyServicesUseCase(
      serviceRepo,
      paymentRepo,
      linkedDebtsGatherer as unknown as LinkedDebtsGatherer,
    );
  });

  it('returns an empty list (and skips the SQL aggregate) when the user has no services', async () => {
    serviceRepo.findByUserId.mockResolvedValue([]);

    const result = await useCase.execute('user-1', false, currentPeriod, timezone);

    expect(result).toEqual([]);
    expect(serviceRepo.findByUserId).toHaveBeenCalledWith('user-1', false);
    // Empty serviceIds is a wasted round-trip — the use case short-circuits.
    expect(paymentRepo.sumByServiceIdsInPeriod).not.toHaveBeenCalled();
  });

  it('forwards includeArchived=true to the repository', async () => {
    serviceRepo.findByUserId.mockResolvedValue([]);
    await useCase.execute('user-1', true, currentPeriod, timezone);
    expect(serviceRepo.findByUserId).toHaveBeenCalledWith('user-1', true);
  });

  it('attaches paidAmountForCurrentMonth from the v1.0.0 payments aggregate, defaulting to 0 when absent', async () => {
    const services = [
      buildMonthlyService({ id: 'svc-1', userId: 'user-1' }),
      buildMonthlyService({ id: 'svc-2', userId: 'user-1' }),
      buildMonthlyService({ id: 'svc-3', userId: 'user-1' }),
    ];
    serviceRepo.findByUserId.mockResolvedValue(services);
    // Only two of the three services have payments this period — the third
    // must surface as 0 (not undefined / null) so the frontend can sum without
    // nullish guards.
    paymentRepo.sumByServiceIdsInPeriod.mockResolvedValue(
      new Map([
        ['svc-1', 35.5],
        ['svc-2', 90],
      ]),
    );

    const result = await useCase.execute('user-1', false, currentPeriod, timezone);

    expect(result).toEqual([
      { service: services[0], paidAmountForCurrentMonth: 35.5, linkedDebts: [] },
      { service: services[1], paidAmountForCurrentMonth: 90, linkedDebts: [] },
      { service: services[2], paidAmountForCurrentMonth: 0, linkedDebts: [] },
    ]);
    // v1.0.0: no timezone arg because the MSP table buckets by literal
    // YYYY-MM period column (the repo's `sumByServiceIdsInPeriod` is
    // timezone-free).
    expect(paymentRepo.sumByServiceIdsInPeriod).toHaveBeenCalledWith(
      ['svc-1', 'svc-2', 'svc-3'],
      currentPeriod,
    );
  });

  it('gathers linkedDebts per service via LinkedDebtsGatherer', async () => {
    const services = [
      buildMonthlyService({ id: 'svc-1', userId: 'user-1' }),
      buildMonthlyService({ id: 'svc-2', userId: 'user-1' }),
    ];
    serviceRepo.findByUserId.mockResolvedValue(services);
    linkedDebtsGatherer.forService.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'svc-1'
          ? [{ id: 'debt-1', reference: 'Ana', remainingAmount: 100, status: 'PENDING' as const }]
          : [],
      ),
    );

    const result = await useCase.execute('user-1', false, currentPeriod, timezone);

    expect(linkedDebtsGatherer.forService).toHaveBeenCalledWith('svc-1');
    expect(linkedDebtsGatherer.forService).toHaveBeenCalledWith('svc-2');
    expect(result[0].linkedDebts).toEqual([
      { id: 'debt-1', reference: 'Ana', remainingAmount: 100, status: 'PENDING' },
    ]);
    expect(result[1].linkedDebts).toEqual([]);
  });
});
