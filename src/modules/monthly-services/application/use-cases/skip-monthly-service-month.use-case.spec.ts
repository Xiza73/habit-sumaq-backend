import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { DomainException } from '@common/exceptions/domain.exception';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { SkipMonthlyServiceMonthUseCase } from './skip-monthly-service-month.use-case';

describe('SkipMonthlyServiceMonthUseCase', () => {
  let useCase: SkipMonthlyServiceMonthUseCase;
  let repo: jest.Mocked<MonthlyServiceRepository>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  const userId = 'user-1';

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      softDelete: jest.fn(),
    } as jest.Mocked<MonthlyServiceRepository>;

    mockLogger = buildMockPinoLogger();
    useCase = new SkipMonthlyServiceMonthUseCase(repo, mockLogger as unknown as PinoLogger);
  });

  it('advances lastPaidPeriod to the next due period and does not create a transaction', async () => {
    const service = buildMonthlyService({
      userId,
      startPeriod: '2026-04',
      lastPaidPeriod: '2026-05',
    });
    repo.findById.mockResolvedValue(service);

    const result = await useCase.execute(service.id, userId, { reason: 'free month' });

    // next due before skip = 2026-06; skip moves lastPaidPeriod to that value
    expect(result.lastPaidPeriod).toBe('2026-06');
  });

  it('skips the very first period when the service was never paid', async () => {
    const service = buildMonthlyService({
      userId,
      startPeriod: '2026-04',
      lastPaidPeriod: null,
    });
    repo.findById.mockResolvedValue(service);

    const result = await useCase.execute(service.id, userId, {});

    expect(result.lastPaidPeriod).toBe('2026-04');
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND on unknown id', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId, {})).rejects.toThrow(DomainException);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when service belongs to another user', async () => {
    repo.findById.mockResolvedValue(buildMonthlyService({ userId: 'other' }));

    await expect(useCase.execute('x', userId, {})).rejects.toThrow(
      'Servicio mensual no encontrado',
    );
  });
});
