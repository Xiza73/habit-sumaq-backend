import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';
import { type CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { buildMonthlyServicePayment } from '../../../domain/__tests__/monthly-service-payment.factory';
import { type MonthlyServicePaymentRepository } from '../../../domain/monthly-service-payment.repository';
import { UpdateMonthlyServicePaymentUseCase } from '../update-monthly-service-payment.use-case';

describe('UpdateMonthlyServicePaymentUseCase', () => {
  let repo: jest.Mocked<MonthlyServicePaymentRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: UpdateMonthlyServicePaymentUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  const USER = 'user-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  beforeEach(() => {
    repo = {
      findByServiceId: jest.fn(),
      findById: jest.fn(),
      findByServiceAndPeriod: jest.fn(),
      sumByCurrencyInRange: jest.fn(),
      dailyByCurrencyInRange: jest.fn(),
      findLastNByServiceId: jest.fn().mockResolvedValue([]),
      sumByServiceIdsInPeriod: jest.fn().mockResolvedValue(new Map()),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      softDelete: jest.fn(),
    };
    pool = { applyDelta: jest.fn() } as unknown as jest.Mocked<CurrencyPoolService>;
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };
    logger = buildMockPinoLogger();
    useCase = new UpdateMonthlyServicePaymentUseCase(
      repo,
      pool,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  describe('guards', () => {
    it('throws MSP_001 when missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(useCase.execute('x', USER, { amount: 60 })).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_PAYMENT_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws MSP_002 for cross-user', async () => {
      repo.findById.mockResolvedValue(buildMonthlyServicePayment({ userId: 'other' }));
      await expect(useCase.execute('x', USER, { amount: 60 })).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER',
      } satisfies Partial<DomainException>);
    });
  });

  describe('pure metadata update (amount unchanged)', () => {
    it('skips the tx wrapper, no pool call', async () => {
      repo.findById.mockResolvedValue(buildMonthlyServicePayment({ userId: USER, amount: 50 }));
      await useCase.execute('x', USER, { description: 'new desc' });

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(pool.applyDelta).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('amount change → pool delta', () => {
    it('amount UP: applyDelta is NEGATIVE (extra debit)', async () => {
      repo.findById.mockResolvedValue(
        buildMonthlyServicePayment({ userId: USER, amount: 50, currency: Currency.PEN }),
      );
      await useCase.execute('x', USER, { amount: 80 });
      // oldAmount(50) - newAmount(80) = -30
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -30, FAKE_MGR);
    });

    it('amount DOWN: applyDelta is POSITIVE (refund of difference)', async () => {
      repo.findById.mockResolvedValue(
        buildMonthlyServicePayment({ userId: USER, amount: 50, currency: Currency.PEN }),
      );
      await useCase.execute('x', USER, { amount: 30 });
      // oldAmount(50) - newAmount(30) = +20
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, 20, FAKE_MGR);
    });

    it('forwards the EntityManager to repo.save', async () => {
      repo.findById.mockResolvedValue(buildMonthlyServicePayment({ userId: USER, amount: 50 }));
      await useCase.execute('x', USER, { amount: 60 });
      expect(repo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
    });

    it('logs with oldAmount + newAmount + poolDelta', async () => {
      repo.findById.mockResolvedValue(
        buildMonthlyServicePayment({ userId: USER, amount: 50, currency: Currency.PEN }),
      );
      await useCase.execute('x', USER, { amount: 75 });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'monthly_service_payment.updated',
          amountChanged: true,
          oldAmount: 50,
          newAmount: 75,
          poolDelta: -25,
        }),
        'monthly_service_payment.updated',
      );
    });
  });
});
