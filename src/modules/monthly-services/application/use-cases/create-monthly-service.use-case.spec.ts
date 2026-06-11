import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { DomainException } from '@common/exceptions/domain.exception';
import { buildCategory } from '@modules/categories/domain/__tests__/category.factory';
import { type CategoryRepository } from '@modules/categories/domain/category.repository';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { CreateMonthlyServiceUseCase } from './create-monthly-service.use-case';

import type { CreateMonthlyServiceDto } from '../dto/create-monthly-service.dto';

describe('CreateMonthlyServiceUseCase', () => {
  let useCase: CreateMonthlyServiceUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let categoryRepo: jest.Mocked<CategoryRepository>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  const userId = 'user-1';
  const baseDto: CreateMonthlyServiceDto = {
    name: 'Netflix',
    // v1.0.0 (A6-W.4): `defaultAccountId` is now OPTIONAL. The use case
    // doesn't validate it against the accounts module anymore — payments
    // debit the currency pool. We still pass it in some scenarios to make
    // sure the value round-trips on the saved entity.
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
    };

    categoryRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn().mockResolvedValue(buildCategory({ id: 'cat-1', userId })),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    mockLogger = buildMockPinoLogger();
    useCase = new CreateMonthlyServiceUseCase(
      serviceRepo,
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

  it('persists `defaultAccountId` as null when the DTO omits it (v1.0.0 default)', async () => {
    const result = await useCase.execute(userId, baseDto, 'UTC');
    expect(result.defaultAccountId).toBeNull();
  });

  it('round-trips a provided `defaultAccountId` without account-existence validation', async () => {
    // The use case no longer fetches the account or validates ownership /
    // currency. A garbage UUID is accepted as-is — it'll be dropped from
    // the column in A7-B.
    const result = await useCase.execute(
      userId,
      { ...baseDto, defaultAccountId: '00000000-0000-4000-8000-000000000099' },
      'UTC',
    );
    expect(result.defaultAccountId).toBe('00000000-0000-4000-8000-000000000099');
  });

  it('defaults frequencyMonths to 1 (monthly) when not provided', async () => {
    const result = await useCase.execute(userId, baseDto, 'UTC');
    expect(result.frequencyMonths).toBe(1);
  });

  it('honors the requested frequencyMonths and shapes nextDuePeriod accordingly', async () => {
    // Quarterly service starting in April -> nextDuePeriod is still April
    // (it has not been paid yet); after first pay it would jump to July.
    const result = await useCase.execute(userId, { ...baseDto, frequencyMonths: 3 }, 'UTC');
    expect(result.frequencyMonths).toBe(3);
    expect(result.nextDuePeriod()).toBe('2026-04');
  });

  it('defaults startPeriod to current month when not provided', async () => {
    const dto = { ...baseDto, startPeriod: undefined };
    const result = await useCase.execute(userId, dto, 'UTC');

    // Format YYYY-MM
    expect(result.startPeriod).toMatch(/^\d{4}-\d{2}$/);
  });

  it('throws CATEGORY_NOT_FOUND when category does not exist', async () => {
    categoryRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow(DomainException);
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
