import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';
import { type CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';
import { buildDebtLoan } from '@modules/debts-loans/domain/__tests__/debt-loan.factory';
import { type DebtLoanRepository } from '@modules/debts-loans/domain/debt-loan.repository';
import { DebtLoanStatus } from '@modules/debts-loans/domain/enums/debt-loan-status.enum';

import { buildMonthlyServicePayment } from '../../../domain/__tests__/monthly-service-payment.factory';
import { type MonthlyServicePaymentRepository } from '../../../domain/monthly-service-payment.repository';
import { DeleteMonthlyServicePaymentUseCase } from '../delete-monthly-service-payment.use-case';

describe('DeleteMonthlyServicePaymentUseCase', () => {
  let repo: jest.Mocked<MonthlyServicePaymentRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let debtLoanRepo: jest.Mocked<Pick<DebtLoanRepository, 'findBySourcePaymentIds' | 'softDelete'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: DeleteMonthlyServicePaymentUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  const USER = 'user-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  beforeEach(() => {
    repo = {
      findByServiceId: jest.fn(),
      findByServiceIds: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      findByServiceAndPeriod: jest.fn(),
      sumByCurrencyInRange: jest.fn(),
      dailyByCurrencyInRange: jest.fn(),
      findLastNByServiceId: jest.fn(),
      sumByServiceIdsInPeriod: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    pool = { applyDelta: jest.fn() } as unknown as jest.Mocked<CurrencyPoolService>;
    debtLoanRepo = {
      findBySourcePaymentIds: jest.fn().mockResolvedValue([]),
      softDelete: jest.fn(),
    };
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };
    logger = buildMockPinoLogger();
    useCase = new DeleteMonthlyServicePaymentUseCase(
      repo,
      pool,
      debtLoanRepo as unknown as DebtLoanRepository,
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

  describe('linked-debt cascade (shared-service-payments slice 2)', () => {
    it('soft-deletes UNSETTLED linked debts inside the SAME transaction', async () => {
      const p = buildMonthlyServicePayment({ id: 'payment-1', userId: USER, amount: 180 });
      repo.findById.mockResolvedValue(p);
      debtLoanRepo.findBySourcePaymentIds.mockResolvedValue([
        buildDebtLoan({ id: 'debt-pending-1', status: DebtLoanStatus.PENDING }),
        buildDebtLoan({ id: 'debt-pending-2', status: DebtLoanStatus.PENDING }),
      ]);

      await useCase.execute(p.id, USER);

      expect(debtLoanRepo.findBySourcePaymentIds).toHaveBeenCalledWith([p.id], FAKE_MGR);
      expect(debtLoanRepo.softDelete).toHaveBeenCalledTimes(2);
      expect(debtLoanRepo.softDelete).toHaveBeenCalledWith('debt-pending-1', FAKE_MGR);
      expect(debtLoanRepo.softDelete).toHaveBeenCalledWith('debt-pending-2', FAKE_MGR);
    });

    it('does NOT soft-delete SETTLED linked debts (they remain as history)', async () => {
      const p = buildMonthlyServicePayment({ id: 'payment-1', userId: USER, amount: 100 });
      repo.findById.mockResolvedValue(p);
      debtLoanRepo.findBySourcePaymentIds.mockResolvedValue([
        buildDebtLoan({ id: 'debt-settled', status: DebtLoanStatus.SETTLED, remainingAmount: 0 }),
      ]);

      await useCase.execute(p.id, USER);

      expect(debtLoanRepo.softDelete).not.toHaveBeenCalled();
    });

    it('does NOT revert the pool credit of a SETTLED linked debt (only the payment refund applies)', async () => {
      const p = buildMonthlyServicePayment({
        id: 'payment-1',
        userId: USER,
        amount: 100,
        currency: Currency.PEN,
      });
      repo.findById.mockResolvedValue(p);
      debtLoanRepo.findBySourcePaymentIds.mockResolvedValue([
        buildDebtLoan({ id: 'debt-settled', status: DebtLoanStatus.SETTLED, remainingAmount: 0 }),
      ]);

      await useCase.execute(p.id, USER);

      // Only ONE applyDelta call — the payment's own refund. No second call
      // reverting the settled LOAN's earlier pool credit.
      expect(pool.applyDelta).toHaveBeenCalledTimes(1);
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, 100, FAKE_MGR);
    });

    it('mixes PENDING (soft-deleted) and SETTLED (untouched) linked debts correctly (triangulation)', async () => {
      const p = buildMonthlyServicePayment({ id: 'payment-1', userId: USER, amount: 180 });
      repo.findById.mockResolvedValue(p);
      debtLoanRepo.findBySourcePaymentIds.mockResolvedValue([
        buildDebtLoan({ id: 'debt-pending', status: DebtLoanStatus.PENDING }),
        buildDebtLoan({ id: 'debt-settled', status: DebtLoanStatus.SETTLED, remainingAmount: 0 }),
      ]);

      await useCase.execute(p.id, USER);

      expect(debtLoanRepo.softDelete).toHaveBeenCalledTimes(1);
      expect(debtLoanRepo.softDelete).toHaveBeenCalledWith('debt-pending', FAKE_MGR);
    });

    it('is a no-op when the payment has no linked debts (non-shared payment, regression guard)', async () => {
      const p = buildMonthlyServicePayment({ id: 'payment-1', userId: USER, amount: 50 });
      repo.findById.mockResolvedValue(p);
      debtLoanRepo.findBySourcePaymentIds.mockResolvedValue([]);

      await useCase.execute(p.id, USER);

      expect(debtLoanRepo.softDelete).not.toHaveBeenCalled();
    });
  });
});
