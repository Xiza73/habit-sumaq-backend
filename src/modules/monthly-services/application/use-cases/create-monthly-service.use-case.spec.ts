import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { DomainException } from '@common/exceptions/domain.exception';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';
import { Currency } from '@modules/accounts/domain/enums/currency.enum';
import { buildCategory } from '@modules/categories/domain/__tests__/category.factory';
import { type CategoryRepository } from '@modules/categories/domain/category.repository';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { CreateMonthlyServiceUseCase } from './create-monthly-service.use-case';

import type { CreateMonthlyServiceDto } from '../dto/create-monthly-service.dto';

describe('CreateMonthlyServiceUseCase', () => {
  let useCase: CreateMonthlyServiceUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let accountRepo: jest.Mocked<AccountRepository>;
  let categoryRepo: jest.Mocked<CategoryRepository>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  const userId = 'user-1';
  const baseDto: CreateMonthlyServiceDto = {
    name: 'Netflix',
    defaultAccountId: 'acc-1',
    categoryId: 'cat-1',
    currency: 'PEN',
    estimatedAmount: 45,
    dueDay: 15,
    startPeriod: '2026-04',
  };

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
      findById: jest
        .fn()
        .mockResolvedValue(buildAccount({ id: 'acc-1', userId, currency: Currency.PEN })),
      findByIds: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    } as jest.Mocked<AccountRepository>;

    categoryRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn().mockResolvedValue(buildCategory({ id: 'cat-1', userId })),
      save: jest.fn(),
      softDelete: jest.fn(),
    } as jest.Mocked<CategoryRepository>;

    mockLogger = buildMockPinoLogger();
    useCase = new CreateMonthlyServiceUseCase(
      serviceRepo,
      accountRepo,
      categoryRepo,
      mockLogger as unknown as PinoLogger,
    );
  });

  it('creates a service with the provided startPeriod', async () => {
    const result = await useCase.execute(userId, baseDto, 'America/Lima');

    expect(result.name).toBe('Netflix');
    expect(result.startPeriod).toBe('2026-04');
    expect(result.lastPaidPeriod).toBeNull();
    expect(result.isActive).toBe(true);
    expect(result.estimatedAmount).toBe(45);
    expect(result.dueDay).toBe(15);
    expect(serviceRepo.save).toHaveBeenCalled();
  });

  it('defaults startPeriod to current month when not provided', async () => {
    const dto = { ...baseDto, startPeriod: undefined };
    const result = await useCase.execute(userId, dto, 'UTC');

    // Format YYYY-MM
    expect(result.startPeriod).toMatch(/^\d{4}-\d{2}$/);
  });

  it('throws ACCOUNT_NOT_FOUND when default account does not exist', async () => {
    accountRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow(DomainException);
    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow('Cuenta no encontrada');
  });

  it('throws ACCOUNT_NOT_FOUND when account is owned by another user', async () => {
    accountRepo.findById.mockResolvedValue(
      buildAccount({ id: 'acc-1', userId: 'other', currency: Currency.PEN }),
    );

    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow('Cuenta no encontrada');
  });

  it('throws CURRENCY_MISMATCH when dto currency does not match account currency', async () => {
    accountRepo.findById.mockResolvedValue(
      buildAccount({ id: 'acc-1', userId, currency: Currency.USD }),
    );

    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow(
      'La moneda del servicio debe coincidir con la moneda de la cuenta por defecto',
    );
  });

  it('throws CATEGORY_NOT_FOUND when category does not exist', async () => {
    categoryRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow(
      'Categoría no encontrada',
    );
  });

  it('throws CATEGORY_NOT_FOUND when category is owned by another user', async () => {
    categoryRepo.findById.mockResolvedValue(buildCategory({ id: 'cat-1', userId: 'other' }));

    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow(
      'Categoría no encontrada',
    );
  });

  it('throws MONTHLY_SERVICE_NAME_TAKEN when an active service with the same name exists', async () => {
    serviceRepo.findActiveByUserIdAndName.mockResolvedValue(
      buildMonthlyService({ userId, name: 'Netflix' }),
    );

    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow(
      'Ya tienes un servicio activo con ese nombre',
    );
  });
});
