import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';
import { type CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { buildMonthlyServicePayment } from '../../../domain/__tests__/monthly-service-payment.factory';
import { type MonthlyServicePaymentRepository } from '../../../domain/monthly-service-payment.repository';
import { DeleteMonthlyServicePaymentUseCase } from '../delete-monthly-service-payment.use-case';

describe('DeleteMonthlyServicePaymentUseCase', () => {
  let repo: jest.Mocked<MonthlyServicePaymentRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: DeleteMonthlyServicePaymentUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  const USER = 'user-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  beforeEach(() => {
    repo = {
      findByServiceId: jest.fn(),
      findById: jest.fn(),
      findByServiceAndPeriod: jest.fn(),
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
    useCase = new DeleteMonthlyServicePaymentUseCase(
      repo,
      pool,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  describe('guards', () => {
    it('throws MSP_001 when missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(useCase.execute('x', USER)).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_PAYMENT_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws MSP_001 when already soft-deleted', async () => {
      repo.findById.mockResolvedValue(
        buildMonthlyServicePayment({ userId: USER, deletedAt: new Date() }),
      );
      await expect(useCase.execute('x', USER)).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_PAYMENT_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws MSP_002 on cross-user', async () => {
      repo.findById.mockResolvedValue(buildMonthlyServicePayment({ userId: 'other' }));
      await expect(useCase.execute('x', USER)).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER',
      } satisfies Partial<DomainException>);
    });
  });

  it('soft-deletes the row AND refunds the pool by amount, atomically', async () => {
    const p = buildMonthlyServicePayment({
      userId: USER,
      amount: 60,
      currency: Currency.PEN,
    });
    repo.findById.mockResolvedValue(p);

    await useCase.execute(p.id, USER);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(repo.softDelete).toHaveBeenCalledWith(p.id, FAKE_MGR);
    expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, 60, FAKE_MGR);
  });

  it('logs deletion with the refund amount + period', async () => {
    const p = buildMonthlyServicePayment({
      userId: USER,
      amount: 40,
      period: '2026-06',
      currency: Currency.PEN,
    });
    repo.findById.mockResolvedValue(p);

    await useCase.execute(p.id, USER);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'monthly_service_payment.deleted',
        refundAmount: 40,
        period: '2026-06',
      }),
      'monthly_service_payment.deleted',
    );
  });
});
