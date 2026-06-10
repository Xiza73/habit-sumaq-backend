import { DomainException } from '@common/exceptions/domain.exception';
import { buildMonthlyServicePayment } from '@modules/monthly-service-payments/domain/__tests__/monthly-service-payment.factory';
import { type MonthlyServicePaymentRepository } from '@modules/monthly-service-payments/domain/monthly-service-payment.repository';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { DeleteMonthlyServiceUseCase } from './delete-monthly-service.use-case';

describe('DeleteMonthlyServiceUseCase', () => {
  let useCase: DeleteMonthlyServiceUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let paymentRepo: jest.Mocked<MonthlyServicePaymentRepository>;

  const userId = 'user-1';

  beforeEach(() => {
    serviceRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    paymentRepo = {
      findByServiceId: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      findByServiceAndPeriod: jest.fn(),
      sumByCurrencyInRange: jest.fn(),
      dailyByCurrencyInRange: jest.fn(),
      findLastNByServiceId: jest.fn(),
      sumByServiceIdsInPeriod: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    useCase = new DeleteMonthlyServiceUseCase(serviceRepo, paymentRepo);
  });

  it('soft-deletes the service when there are no recorded payments', async () => {
    const service = buildMonthlyService({ userId });
    serviceRepo.findById.mockResolvedValue(service);
    paymentRepo.findByServiceId.mockResolvedValue([]);

    await useCase.execute(service.id, userId);

    expect(serviceRepo.softDelete).toHaveBeenCalledWith(service.id);
  });

  it('throws MONTHLY_SERVICE_HAS_PAYMENTS when the service has payments', async () => {
    const service = buildMonthlyService({ userId });
    serviceRepo.findById.mockResolvedValue(service);
    paymentRepo.findByServiceId.mockResolvedValue([
      buildMonthlyServicePayment({ monthlyServiceId: service.id }),
    ]);

    await expect(useCase.execute(service.id, userId)).rejects.toThrow(DomainException);
    await expect(useCase.execute(service.id, userId)).rejects.toThrow(
      /No se puede eliminar un servicio con pagos registrados/,
    );
    expect(serviceRepo.softDelete).not.toHaveBeenCalled();
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND on unknown id', async () => {
    serviceRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId)).rejects.toThrow('Servicio mensual no encontrado');
  });

  it('hides services owned by other users', async () => {
    serviceRepo.findById.mockResolvedValue(buildMonthlyService({ userId: 'other' }));

    await expect(useCase.execute('x', userId)).rejects.toThrow('Servicio mensual no encontrado');
  });
});
