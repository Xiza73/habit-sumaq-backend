import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';
import { type CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { buildDebtLoan } from '../../../domain/__tests__/debt-loan.factory';
import { type DebtLoanRepository } from '../../../domain/debt-loan.repository';
import { type DebtLoanPaymentRepository } from '../../../domain/debt-loan-payment.repository';
import { DebtLoanStatus } from '../../../domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../../../domain/enums/debt-loan-type.enum';
import { SettleDebtLoanUseCase } from '../settle-debt-loan.use-case';

describe('SettleDebtLoanUseCase', () => {
  let repo: jest.Mocked<DebtLoanRepository>;
  let paymentRepo: jest.Mocked<DebtLoanPaymentRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: SettleDebtLoanUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  const USER = 'user-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      aggregateByReference: jest.fn(),
      findPendingByNormalizedReference: jest.fn(),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      softDelete: jest.fn(),
      findBySourcePaymentIds: jest.fn().mockResolvedValue([]),
    };
    paymentRepo = {
      create: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      findByDebtLoanId: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn(),
    };
    pool = { applyDelta: jest.fn() } as unknown as jest.Mocked<CurrencyPoolService>;
    // Mock DataSource.transaction to immediately invoke the callback with
    // a fake EntityManager, returning whatever the callback returns.
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };
    logger = buildMockPinoLogger();
    useCase = new SettleDebtLoanUseCase(
      repo,
      paymentRepo,
      pool,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  describe('guards', () => {
    it('throws DEBT_LOAN_NOT_FOUND when missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(useCase.execute('x', USER, { settledAmount: 1 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws DEBT_LOAN_NOT_FOUND when soft-deleted', async () => {
      repo.findById.mockResolvedValue(buildDebtLoan({ userId: USER, deletedAt: new Date() }));
      await expect(useCase.execute('x', USER, { settledAmount: 1 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws DEBT_LOAN_BELONGS_TO_OTHER_USER for cross-user', async () => {
      repo.findById.mockResolvedValue(buildDebtLoan({ userId: 'other' }));
      await expect(useCase.execute('x', USER, { settledAmount: 1 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_BELONGS_TO_OTHER_USER',
      } satisfies Partial<DomainException>);
    });

    it('throws DEBT_LOAN_ALREADY_SETTLED on a SETTLED row', async () => {
      repo.findById.mockResolvedValue(
        buildDebtLoan({ userId: USER, status: DebtLoanStatus.SETTLED, remainingAmount: 0 }),
      );
      await expect(useCase.execute('x', USER, { settledAmount: 1 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_ALREADY_SETTLED',
      } satisfies Partial<DomainException>);
    });

    it('throws DEBT_LOAN_SETTLEMENT_EXCEEDS_REMAINING when settledAmount > remaining', async () => {
      repo.findById.mockResolvedValue(buildDebtLoan({ userId: USER, remainingAmount: 50 }));
      await expect(useCase.execute('x', USER, { settledAmount: 51 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_SETTLEMENT_EXCEEDS_REMAINING',
      } satisfies Partial<DomainException>);
    });

    it('throws CURRENCY_MISMATCH if dto.currency differs from debt currency', async () => {
      repo.findById.mockResolvedValue(
        buildDebtLoan({ userId: USER, currency: Currency.PEN, remainingAmount: 100 }),
      );
      await expect(
        useCase.execute('x', USER, { settledAmount: 50, currency: Currency.USD }),
      ).rejects.toMatchObject({ code: 'CURRENCY_MISMATCH' } satisfies Partial<DomainException>);
    });
  });

  describe('informal-close mode (no currency)', () => {
    it('marks the row SETTLED on full settle without touching pool', async () => {
      repo.findById.mockResolvedValue(
        buildDebtLoan({ userId: USER, remainingAmount: 100, status: DebtLoanStatus.PENDING }),
      );
      const result = await useCase.execute('x', USER, { settledAmount: 100 });

      expect(result.status).toBe(DebtLoanStatus.SETTLED);
      expect(result.remainingAmount).toBe(0);
      expect(pool.applyDelta).not.toHaveBeenCalled();
    });

    it('partial settle keeps row PENDING and reduces remaining', async () => {
      repo.findById.mockResolvedValue(
        buildDebtLoan({ userId: USER, amount: 100, remainingAmount: 100 }),
      );
      const result = await useCase.execute('x', USER, { settledAmount: 30 });

      expect(result.status).toBe(DebtLoanStatus.PENDING);
      expect(result.remainingAmount).toBe(70);
      expect(pool.applyDelta).not.toHaveBeenCalled();
    });

    it('logs with mode=informal', async () => {
      repo.findById.mockResolvedValue(buildDebtLoan({ userId: USER, remainingAmount: 100 }));
      await useCase.execute('x', USER, { settledAmount: 30 });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'debt_loan.settled', mode: 'informal' }),
        'debt_loan.settled',
      );
    });

    it('inserts a payment row with currency=null inside the same tx', async () => {
      const debt = buildDebtLoan({ userId: USER, remainingAmount: 100 });
      repo.findById.mockResolvedValue(debt);

      await useCase.execute(debt.id, USER, { settledAmount: 40 });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(paymentRepo.create).toHaveBeenCalledTimes(1);
      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          debtLoanId: debt.id,
          amount: 40,
          currency: null,
          note: null,
        }),
        FAKE_MGR,
      );
    });
  });

  describe('real-payment mode (currency provided)', () => {
    it('DEBT settle debits the pool (negative delta) inside a tx', async () => {
      repo.findById.mockResolvedValue(
        buildDebtLoan({
          userId: USER,
          type: DebtLoanType.DEBT,
          currency: Currency.PEN,
          amount: 100,
          remainingAmount: 100,
        }),
      );

      await useCase.execute('x', USER, { settledAmount: 40, currency: Currency.PEN });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -40, FAKE_MGR);
    });

    it('LOAN settle credits the pool (positive delta) inside a tx', async () => {
      repo.findById.mockResolvedValue(
        buildDebtLoan({
          userId: USER,
          type: DebtLoanType.LOAN,
          currency: Currency.USD,
          amount: 200,
          remainingAmount: 200,
        }),
      );

      await useCase.execute('x', USER, { settledAmount: 75, currency: Currency.USD });

      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.USD, 75, FAKE_MGR);
    });

    it('forwards the same EntityManager to the repo.save call', async () => {
      repo.findById.mockResolvedValue(
        buildDebtLoan({
          userId: USER,
          type: DebtLoanType.DEBT,
          currency: Currency.PEN,
          remainingAmount: 100,
        }),
      );

      await useCase.execute('x', USER, { settledAmount: 50, currency: Currency.PEN });

      expect(repo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
    });

    it('logs with mode=real-payment and includes the pool delta', async () => {
      repo.findById.mockResolvedValue(
        buildDebtLoan({
          userId: USER,
          type: DebtLoanType.DEBT,
          currency: Currency.PEN,
          remainingAmount: 100,
        }),
      );

      await useCase.execute('x', USER, { settledAmount: 40, currency: Currency.PEN });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'debt_loan.settled',
          mode: 'real-payment',
          poolDelta: -40,
        }),
        'debt_loan.settled',
      );
    });

    it('inserts a payment row with the debt currency inside the same tx', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        remainingAmount: 100,
      });
      repo.findById.mockResolvedValue(debt);

      await useCase.execute(debt.id, USER, { settledAmount: 40, currency: Currency.PEN });

      expect(paymentRepo.create).toHaveBeenCalledTimes(1);
      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          debtLoanId: debt.id,
          amount: 40,
          currency: Currency.PEN,
          note: null,
        }),
        FAKE_MGR,
      );
    });
  });
});
