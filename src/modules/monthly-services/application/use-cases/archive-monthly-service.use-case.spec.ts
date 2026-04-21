import { DomainException } from '@common/exceptions/domain.exception';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { ArchiveMonthlyServiceUseCase } from './archive-monthly-service.use-case';

describe('ArchiveMonthlyServiceUseCase', () => {
  let useCase: ArchiveMonthlyServiceUseCase;
  let repo: jest.Mocked<MonthlyServiceRepository>;

  const userId = 'user-1';

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      softDelete: jest.fn(),
    } as jest.Mocked<MonthlyServiceRepository>;

    useCase = new ArchiveMonthlyServiceUseCase(repo);
  });

  it('toggles an active service to archived', async () => {
    const service = buildMonthlyService({ userId, isActive: true });
    repo.findById.mockResolvedValue(service);

    const result = await useCase.execute(service.id, userId);

    expect(result.isActive).toBe(false);
  });

  it('toggles an archived service back to active', async () => {
    const service = buildMonthlyService({ userId, isActive: false });
    repo.findById.mockResolvedValue(service);

    const result = await useCase.execute(service.id, userId);

    expect(result.isActive).toBe(true);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND on unknown id', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId)).rejects.toThrow(DomainException);
  });

  it('hides services owned by other users', async () => {
    repo.findById.mockResolvedValue(buildMonthlyService({ userId: 'other' }));

    await expect(useCase.execute('x', userId)).rejects.toThrow('Servicio mensual no encontrado');
  });
});
