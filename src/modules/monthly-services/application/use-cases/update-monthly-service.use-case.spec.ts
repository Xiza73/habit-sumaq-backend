import { DomainException } from '@common/exceptions/domain.exception';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';
import { Currency } from '@modules/accounts/domain/enums/currency.enum';
import { buildCategory } from '@modules/categories/domain/__tests__/category.factory';
import { type CategoryRepository } from '@modules/categories/domain/category.repository';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { UpdateMonthlyServiceUseCase } from './update-monthly-service.use-case';

describe('UpdateMonthlyServiceUseCase', () => {
  let useCase: UpdateMonthlyServiceUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let accountRepo: jest.Mocked<AccountRepository>;
  let categoryRepo: jest.Mocked<CategoryRepository>;

  const userId = 'user-1';

  beforeEach(() => {
    serviceRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      softDelete: jest.fn(),
    } as jest.Mocked<MonthlyServiceRepository>;

    accountRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    } as jest.Mocked<AccountRepository>;

    categoryRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    } as jest.Mocked<CategoryRepository>;

    useCase = new UpdateMonthlyServiceUseCase(serviceRepo, accountRepo, categoryRepo);
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

  it('validates the new default account belongs to the user and currency matches', async () => {
    const service = buildMonthlyService({ userId, currency: 'PEN' });
    serviceRepo.findById.mockResolvedValue(service);
    accountRepo.findById.mockResolvedValue(
      buildAccount({ id: 'acc-2', userId, currency: Currency.PEN }),
    );

    const result = await useCase.execute(service.id, userId, { defaultAccountId: 'acc-2' });

    expect(result.defaultAccountId).toBe('acc-2');
  });

  it('throws CURRENCY_MISMATCH when the new account has a different currency', async () => {
    const service = buildMonthlyService({ userId, currency: 'PEN' });
    serviceRepo.findById.mockResolvedValue(service);
    accountRepo.findById.mockResolvedValue(
      buildAccount({ id: 'acc-2', userId, currency: Currency.USD }),
    );

    await expect(
      useCase.execute(service.id, userId, { defaultAccountId: 'acc-2' }),
    ).rejects.toThrow('La cuenta debe tener la misma moneda que el servicio');
  });

  it('throws ACCOUNT_NOT_FOUND when the new account is owned by another user', async () => {
    const service = buildMonthlyService({ userId });
    serviceRepo.findById.mockResolvedValue(service);
    accountRepo.findById.mockResolvedValue(
      buildAccount({ id: 'acc-2', userId: 'other', currency: Currency.PEN }),
    );

    await expect(
      useCase.execute(service.id, userId, { defaultAccountId: 'acc-2' }),
    ).rejects.toThrow('Cuenta no encontrada');
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
