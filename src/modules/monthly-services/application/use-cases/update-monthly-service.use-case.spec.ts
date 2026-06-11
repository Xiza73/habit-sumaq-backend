import { DomainException } from '@common/exceptions/domain.exception';
import { buildCategory } from '@modules/categories/domain/__tests__/category.factory';
import { type CategoryRepository } from '@modules/categories/domain/category.repository';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { UpdateMonthlyServiceUseCase } from './update-monthly-service.use-case';

describe('UpdateMonthlyServiceUseCase', () => {
  let useCase: UpdateMonthlyServiceUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let categoryRepo: jest.Mocked<CategoryRepository>;

  const userId = 'user-1';

  beforeEach(() => {
    serviceRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      softDelete: jest.fn(),
    };

    categoryRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    useCase = new UpdateMonthlyServiceUseCase(serviceRepo, categoryRepo);
  });

  it('updates name, estimatedAmount and dueDay', async () => {
    const service = buildMonthlyService({ userId, name: 'Netflix' });
    serviceRepo.findById.mockResolvedValue(service);

    const result = await useCase.execute(service.id, userId, {
      name: 'Netflix Premium',
      estimatedAmount: 55,
      dueDay: 20,
    });

    expect(result.name).toBe('Netflix Premium');
    expect(result.estimatedAmount).toBe(55);
    expect(result.dueDay).toBe(20);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when id is unknown', async () => {
    serviceRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId, { name: 'New' })).rejects.toThrow(DomainException);
  });

  it('hides services owned by other users behind MONTHLY_SERVICE_NOT_FOUND', async () => {
    serviceRepo.findById.mockResolvedValue(buildMonthlyService({ userId: 'other' }));

    await expect(useCase.execute('x', userId, { name: 'New' })).rejects.toThrow(
      'Servicio mensual no encontrado',
    );
  });

  it('throws MONTHLY_SERVICE_NAME_TAKEN when another active service owns the name', async () => {
    const service = buildMonthlyService({ userId, id: 'svc-1', name: 'Netflix' });
    serviceRepo.findById.mockResolvedValue(service);
    serviceRepo.findActiveByUserIdAndName.mockResolvedValue(
      buildMonthlyService({ userId, id: 'svc-2', name: 'Spotify' }),
    );

    await expect(useCase.execute(service.id, userId, { name: 'Spotify' })).rejects.toThrow(
      'Ya tienes un servicio activo con ese nombre',
    );
  });

  it('allows keeping the same name (no-op on the uniqueness check)', async () => {
    const service = buildMonthlyService({ userId, id: 'svc-1', name: 'Netflix' });
    serviceRepo.findById.mockResolvedValue(service);

    const result = await useCase.execute(service.id, userId, { name: 'Netflix' });

    expect(result.name).toBe('Netflix');
    expect(serviceRepo.findActiveByUserIdAndName).not.toHaveBeenCalled();
  });

  it('throws CATEGORY_NOT_FOUND when the new category is owned by another user', async () => {
    const service = buildMonthlyService({ userId });
    serviceRepo.findById.mockResolvedValue(service);
    categoryRepo.findById.mockResolvedValue(buildCategory({ id: 'cat-2', userId: 'other' }));

    await expect(useCase.execute(service.id, userId, { categoryId: 'cat-2' })).rejects.toThrow(
      'Categoría no encontrada',
    );
  });
});
