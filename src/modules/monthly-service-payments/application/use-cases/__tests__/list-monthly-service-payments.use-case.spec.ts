import { type DomainException } from '@common/exceptions/domain.exception';
import { buildMonthlyService } from '@modules/monthly-services/domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '@modules/monthly-services/domain/monthly-service.repository';

import { buildMonthlyServicePayment } from '../../../domain/__tests__/monthly-service-payment.factory';
import { type MonthlyServicePaymentRepository } from '../../../domain/monthly-service-payment.repository';
import { ListMonthlyServicePaymentsUseCase } from '../list-monthly-service-payments.use-case';

describe('ListMonthlyServicePaymentsUseCase', () => {
  let repo: jest.Mocked<MonthlyServicePaymentRepository>;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let useCase: ListMonthlyServicePaymentsUseCase;

  const USER = 'user-1';
  const SERVICE = 'service-1';

  beforeEach(() => {
    repo = {
      findByServiceId: jest.fn(),
      findById: jest.fn(),
      findByServiceAndPeriod: jest.fn(),
      sumByCurrencyInRange: jest.fn(),
      dailyByCurrencyInRange: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    serviceRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new ListMonthlyServicePaymentsUseCase(repo, serviceRepo);
  });

  it('lists payments when the service exists and belongs to the user', async () => {
    serviceRepo.findById.mockResolvedValue(buildMonthlyService({ id: SERVICE, userId: USER }));
    const payments = [buildMonthlyServicePayment({ monthlyServiceId: SERVICE })];
    repo.findByServiceId.mockResolvedValue(payments);

    const result = await useCase.execute(USER, SERVICE);

    expect(result).toBe(payments);
    expect(repo.findByServiceId).toHaveBeenCalledWith(SERVICE);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when the service is missing', async () => {
    serviceRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(USER, SERVICE)).rejects.toMatchObject({
      code: 'MONTHLY_SERVICE_NOT_FOUND',
    } satisfies Partial<DomainException>);
    expect(repo.findByServiceId).not.toHaveBeenCalled();
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when the service is soft-deleted', async () => {
    serviceRepo.findById.mockResolvedValue(
      buildMonthlyService({ userId: USER, deletedAt: new Date() }),
    );
    await expect(useCase.execute(USER, SERVICE)).rejects.toMatchObject({
      code: 'MONTHLY_SERVICE_NOT_FOUND',
    } satisfies Partial<DomainException>);
  });

  it('throws MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER on cross-user access', async () => {
    serviceRepo.findById.mockResolvedValue(
      buildMonthlyService({ id: SERVICE, userId: 'someone-else' }),
    );
    await expect(useCase.execute(USER, SERVICE)).rejects.toMatchObject({
      code: 'MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER',
    } satisfies Partial<DomainException>);
  });
});
