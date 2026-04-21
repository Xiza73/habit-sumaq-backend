import { DomainException } from '@common/exceptions/domain.exception';
import { type TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { DeleteMonthlyServiceUseCase } from './delete-monthly-service.use-case';

describe('DeleteMonthlyServiceUseCase', () => {
  let useCase: DeleteMonthlyServiceUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let txRepo: jest.Mocked<TransactionRepository>;

  const userId = 'user-1';

  beforeEach(() => {
    serviceRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    } as jest.Mocked<MonthlyServiceRepository>;

    txRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByRelatedTransactionId: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      existsByAccountId: jest.fn(),
      aggregateDebtsByReference: jest.fn(),
      findPendingDebtOrLoanByNormalizedReference: jest.fn(),
      sumFlowByCurrencyInRange: jest.fn(),
      topExpenseCategoriesInRange: jest.fn(),
      dailyNetFlowInRange: jest.fn(),
      countByMonthlyServiceId: jest.fn(),
      findLastNByMonthlyServiceId: jest.fn(),
    } as jest.Mocked<TransactionRepository>;

    useCase = new DeleteMonthlyServiceUseCase(serviceRepo, txRepo);
  });

  it('soft-deletes the service when there are no linked transactions', async () => {
    const service = buildMonthlyService({ userId });
    serviceRepo.findById.mockResolvedValue(service);
    txRepo.countByMonthlyServiceId.mockResolvedValue(0);

    await useCase.execute(service.id, userId);

    expect(serviceRepo.softDelete).toHaveBeenCalledWith(service.id);
  });

  it('throws MONTHLY_SERVICE_HAS_PAYMENTS when the service has transactions', async () => {
    const service = buildMonthlyService({ userId });
    serviceRepo.findById.mockResolvedValue(service);
    txRepo.countByMonthlyServiceId.mockResolvedValue(3);

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
