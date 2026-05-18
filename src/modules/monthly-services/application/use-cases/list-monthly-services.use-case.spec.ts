import { type TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { ListMonthlyServicesUseCase } from './list-monthly-services.use-case';

describe('ListMonthlyServicesUseCase', () => {
  let useCase: ListMonthlyServicesUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let txRepo: jest.Mocked<TransactionRepository>;

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

    // Only `sumAmountByMonthlyServiceIdsInPeriod` is touched by this use case
    // — the other methods are stubbed to keep `jest.Mocked<TransactionRepository>`
    // happy without expanding the surface area under test.
    txRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByRelatedTransactionId: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      existsByAccountId: jest.fn(),
      countByMonthlyServiceId: jest.fn(),
      findLastNByMonthlyServiceId: jest.fn(),
      sumAmountByMonthlyServiceIdsInPeriod: jest.fn().mockResolvedValue(new Map<string, number>()),
      findByBudgetId: jest.fn(),
      sumAmountByBudgetId: jest.fn(),
      clearBudgetIdForBudget: jest.fn(),
      aggregateDebtsByReference: jest.fn(),
      findPendingDebtOrLoanByNormalizedReference: jest.fn(),
      sumFlowByCurrencyInRange: jest.fn(),
      topExpenseCategoriesInRange: jest.fn(),
      dailyNetFlowInRange: jest.fn(),
    };

    useCase = new ListMonthlyServicesUseCase(serviceRepo, txRepo);
  });

  it('returns an empty list (and skips the SQL aggregate) when the user has no services', async () => {
    serviceRepo.findByUserId.mockResolvedValue([]);

    const result = await useCase.execute('user-1', false, currentPeriod, timezone);

    expect(result).toEqual([]);
    expect(serviceRepo.findByUserId).toHaveBeenCalledWith('user-1', false);
    // Empty serviceIds is a wasted round-trip — the use case short-circuits.
    expect(txRepo.sumAmountByMonthlyServiceIdsInPeriod).not.toHaveBeenCalled();
  });

  it('forwards includeArchived=true to the repository', async () => {
    serviceRepo.findByUserId.mockResolvedValue([]);
    await useCase.execute('user-1', true, currentPeriod, timezone);
    expect(serviceRepo.findByUserId).toHaveBeenCalledWith('user-1', true);
  });

  it('attaches paidAmountForCurrentMonth from the repo aggregate, defaulting to 0 when absent', async () => {
    const services = [
      buildMonthlyService({ id: 'svc-1', userId: 'user-1' }),
      buildMonthlyService({ id: 'svc-2', userId: 'user-1' }),
      buildMonthlyService({ id: 'svc-3', userId: 'user-1' }),
    ];
    serviceRepo.findByUserId.mockResolvedValue(services);
    // Only two of the three services have payments this period — the third
    // must surface as 0 (not undefined / null) so the frontend can sum without
    // nullish guards.
    txRepo.sumAmountByMonthlyServiceIdsInPeriod.mockResolvedValue(
      new Map([
        ['svc-1', 35.5],
        ['svc-2', 90],
      ]),
    );

    const result = await useCase.execute('user-1', false, currentPeriod, timezone);

    expect(result).toEqual([
      { service: services[0], paidAmountForCurrentMonth: 35.5 },
      { service: services[1], paidAmountForCurrentMonth: 90 },
      { service: services[2], paidAmountForCurrentMonth: 0 },
    ]);
    expect(txRepo.sumAmountByMonthlyServiceIdsInPeriod).toHaveBeenCalledWith(
      ['svc-1', 'svc-2', 'svc-3'],
      currentPeriod,
      timezone,
    );
  });
});
