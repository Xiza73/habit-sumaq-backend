import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';
import { type CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';
import { buildMonthlyService } from '@modules/monthly-services/domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '@modules/monthly-services/domain/monthly-service.repository';

import { buildMonthlyServicePayment } from '../../../domain/__tests__/monthly-service-payment.factory';
import { type MonthlyServicePaymentRepository } from '../../../domain/monthly-service-payment.repository';
import { CreateMonthlyServicePaymentUseCase } from '../create-monthly-service-payment.use-case';

describe('CreateMonthlyServicePaymentUseCase', () => {
  let repo: jest.Mocked<MonthlyServicePaymentRepository>;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: CreateMonthlyServicePaymentUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  const USER = 'user-1';
  const SERVICE = 'service-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  beforeEach(() => {
    repo = {
      findByServiceId: jest.fn(),
      findById: jest.fn(),
      findByServiceAndPeriod: jest.fn(),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      softDelete: jest.fn(),
    };
    serviceRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    pool = { applyDelta: jest.fn() } as unknown as jest.Mocked<CurrencyPoolService>;
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };
    logger = buildMockPinoLogger();
    useCase = new CreateMonthlyServicePaymentUseCase(
      repo,
      serviceRepo,
      pool,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  describe('guards', () => {
    it('throws MSP_005 for malformed period (entity-level validation)', async () => {
      await expect(
        useCase.execute(USER, { monthlyServiceId: SERVICE, period: '2026-13', amount: 30 }),
      ).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_PAYMENT_INVALID_PERIOD_FORMAT',
      } satisfies Partial<DomainException>);
    });

    it('throws MONTHLY_SERVICE_NOT_FOUND when the service does not exist', async () => {
      serviceRepo.findById.mockResolvedValue(null);
      await expect(
        useCase.execute(USER, { monthlyServiceId: SERVICE, period: '2026-06', amount: 30 }),
      ).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws MSP_002 for cross-user service access', async () => {
      serviceRepo.findById.mockResolvedValue(
        buildMonthlyService({ id: SERVICE, userId: 'someone-else' }),
      );
      await expect(
        useCase.execute(USER, { monthlyServiceId: SERVICE, period: '2026-06', amount: 30 }),
      ).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER',
      } satisfies Partial<DomainException>);
    });

    it('throws MSP_003 when a payment already exists for the (service, period) pair', async () => {
      serviceRepo.findById.mockResolvedValue(buildMonthlyService({ id: SERVICE, userId: USER }));
      repo.findByServiceAndPeriod.mockResolvedValue(
        buildMonthlyServicePayment({ monthlyServiceId: SERVICE, period: '2026-06' }),
      );
      await expect(
        useCase.execute(USER, { monthlyServiceId: SERVICE, period: '2026-06', amount: 30 }),
      ).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_PAYMENT_ALREADY_EXISTS_FOR_PERIOD',
      } satisfies Partial<DomainException>);
    });
  });

  describe('happy path', () => {
    beforeEach(() => {
      serviceRepo.findById.mockResolvedValue(
        buildMonthlyService({ id: SERVICE, userId: USER, currency: Currency.PEN }),
      );
      repo.findByServiceAndPeriod.mockResolvedValue(null);
    });

    it('persists the payment and applies a NEGATIVE pool delta of `amount`', async () => {
      await useCase.execute(USER, {
        monthlyServiceId: SERVICE,
        period: '2026-06',
        amount: 45.5,
      });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -45.5, FAKE_MGR);
      expect(repo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
    });

    it('inherits currency from the service (NOT the DTO)', async () => {
      const result = await useCase.execute(USER, {
        monthlyServiceId: SERVICE,
        period: '2026-06',
        amount: 30,
      });
      expect(result.currency).toBe(Currency.PEN);
    });

    it('uses dto.date when provided, otherwise now', async () => {
      const result = await useCase.execute(USER, {
        monthlyServiceId: SERVICE,
        period: '2026-06',
        amount: 30,
        date: '2026-06-15T12:00:00.000Z',
      });
      expect(result.date.toISOString()).toBe('2026-06-15T12:00:00.000Z');
    });

    it('logs creation with period + poolDelta', async () => {
      await useCase.execute(USER, {
        monthlyServiceId: SERVICE,
        period: '2026-06',
        amount: 30,
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'monthly_service_payment.created',
          period: '2026-06',
          poolDelta: -30,
        }),
        'monthly_service_payment.created',
      );
    });
  });
});
