import { DomainException } from '@common/exceptions/domain.exception';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { GetMonthlyServiceUseCase } from './get-monthly-service.use-case';

describe('GetMonthlyServiceUseCase', () => {
  let useCase: GetMonthlyServiceUseCase;
  let repo: jest.Mocked<MonthlyServiceRepository>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    } as jest.Mocked<MonthlyServiceRepository>;
    useCase = new GetMonthlyServiceUseCase(repo);
  });

  it('returns the service when it exists and belongs to the user', async () => {
    const service = buildMonthlyService({ userId: 'user-1' });
    repo.findById.mockResolvedValue(service);

    const result = await useCase.execute(service.id, 'user-1');

    expect(result).toBe(service);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when the id does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', 'user-1')).rejects.toThrow(DomainException);
    await expect(useCase.execute('x', 'user-1')).rejects.toThrow('Servicio mensual no encontrado');
  });

  it('hides the existence of services owned by other users (same error as 404)', async () => {
    const service = buildMonthlyService({ userId: 'other-user' });
    repo.findById.mockResolvedValue(service);

    await expect(useCase.execute(service.id, 'user-1')).rejects.toThrow(
      'Servicio mensual no encontrado',
    );
  });
});
