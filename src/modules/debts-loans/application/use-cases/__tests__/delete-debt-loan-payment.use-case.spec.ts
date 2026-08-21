import { randomUUID } from 'node:crypto';

import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';
import { type CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { buildDebtLoan } from '../../../domain/__tests__/debt-loan.factory';
import { type DebtLoanRepository } from '../../../domain/debt-loan.repository';
import { DebtLoanPayment } from '../../../domain/debt-loan-payment.entity';
import { type DebtLoanPaymentRepository } from '../../../domain/debt-loan-payment.repository';
import { DebtLoanStatus } from '../../../domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../../../domain/enums/debt-loan-type.enum';
import { DeleteDebtLoanPaymentUseCase } from '../delete-debt-loan-payment.use-case';

describe('DeleteDebtLoanPaymentUseCase', () => {
  let debtRepo: jest.Mocked<DebtLoanRepository>;
  let paymentRepo: jest.Mocked<DebtLoanPaymentRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: DeleteDebtLoanPaymentUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  const USER = 'user-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  function buildPayment(
    overrides: Partial<{
      id: string;
      debtLoanId: string;
      amount: number;
      currency: Currency | null;
      note: string | null;
      createdAt: Date;
      paidAt: Date;
    }> = {},
  ): DebtLoanPayment {
    return new DebtLoanPayment(
      overrides.id ?? randomUUID(),
      overrides.debtLoanId ?? randomUUID(),
      overrides.amount ?? 40,
      overrides.currency ?? null,
      overrides.note ?? null,
      overrides.createdAt ?? new Date('2026-02-01T12:00:00.000Z'),
      overrides.paidAt ?? new Date('2026-02-01T12:00:00.000Z'),
    );
  }

  beforeEach(() => {
    debtRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      aggregateByReference: jest.fn(),
      findPendingByNormalizedReference: jest.fn(),
      findPendingByReferenceCurrencyType: jest.fn(),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      softDelete: jest.fn(),
      findBySourcePaymentIds: jest.fn().mockResolvedValue([]),
    };
    paymentRepo = {
      create: jest.fn(),
      findByDebtLoanId: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn().mockResolvedValue(undefined),
    };
    pool = { applyDelta: jest.fn() } as unknown as jest.Mocked<CurrencyPoolService>;
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };
    logger = buildMockPinoLogger();
    useCase = new DeleteDebtLoanPaymentUseCase(
      debtRepo,
      paymentRepo,
      pool,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  describe('guards', () => {
    it('throws DEBT_LOAN_PAYMENT_NOT_FOUND when the payment does not exist', async () => {
      paymentRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute('p', USER)).rejects.toMatchObject({
        code: 'DEBT_LOAN_PAYMENT_NOT_FOUND',
      } satisfies Partial<DomainException>);
      expect(paymentRepo.deleteById).not.toHaveBeenCalled();
    });

    it('throws DEBT_LOAN_NOT_FOUND when the parent debt is missing', async () => {
      paymentRepo.findById.mockResolvedValue(buildPayment());
      debtRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute('p', USER)).rejects.toMatchObject({
        code: 'DEBT_LOAN_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws DEBT_LOAN_NOT_FOUND when the parent debt is soft-deleted', async () => {
      paymentRepo.findById.mockResolvedValue(buildPayment());
      debtRepo.findById.mockResolvedValue(buildDebtLoan({ userId: USER, deletedAt: new Date() }));
      await expect(useCase.execute('p', USER)).rejects.toMatchObject({
        code: 'DEBT_LOAN_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws DEBT_LOAN_BELONGS_TO_OTHER_USER on cross-user delete', async () => {
      paymentRepo.findById.mockResolvedValue(buildPayment());
      debtRepo.findById.mockResolvedValue(buildDebtLoan({ userId: 'someone-else' }));
      await expect(useCase.execute('p', USER)).rejects.toMatchObject({
        code: 'DEBT_LOAN_BELONGS_TO_OTHER_USER',
      } satisfies Partial<DomainException>);
    });
  });

  describe('reopens SETTLED debts', () => {
    it('delete on a SETTLED row reopens to PENDING + adds amount to remaining', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        amount: 100,
        remainingAmount: 0,
        status: DebtLoanStatus.SETTLED,
      });
      const payment = buildPayment({
        debtLoanId: debt.id,
        amount: 100,
        currency: null,
      });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER);

      expect(debt.remainingAmount).toBe(100);
      expect(debt.status).toBe(DebtLoanStatus.PENDING);
      expect(paymentRepo.deleteById).toHaveBeenCalledWith(payment.id, FAKE_MGR);
      expect(debtRepo.save).toHaveBeenCalledWith(debt, FAKE_MGR);
    });
  });

  describe('PENDING debts', () => {
    it('delete on a PENDING row only increases remainingAmount', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        amount: 100,
        remainingAmount: 60,
        status: DebtLoanStatus.PENDING,
      });
      const payment = buildPayment({ debtLoanId: debt.id, amount: 40, currency: null });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER);

      expect(debt.remainingAmount).toBe(100);
      expect(debt.status).toBe(DebtLoanStatus.PENDING);
    });
  });

  describe('real-payment mode — pool reversal', () => {
    it('DEBT: delete returns money to the pool (positive delta)', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        amount: 100,
        remainingAmount: 60,
      });
      const payment = buildPayment({
        debtLoanId: debt.id,
        amount: 40,
        currency: Currency.PEN,
      });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER);

      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, 40, FAKE_MGR);
    });

    it('LOAN: delete pulls money back from the pool (negative delta)', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.LOAN,
        currency: Currency.USD,
        amount: 200,
        remainingAmount: 120,
      });
      const payment = buildPayment({
        debtLoanId: debt.id,
        amount: 80,
        currency: Currency.USD,
      });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER);

      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.USD, -80, FAKE_MGR);
    });

    it('informal delete does NOT touch the pool', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        amount: 100,
        remainingAmount: 60,
      });
      const payment = buildPayment({
        debtLoanId: debt.id,
        amount: 40,
        currency: null, // informal-close payment
      });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER);

      expect(pool.applyDelta).not.toHaveBeenCalled();
    });
  });

  describe('transactionality', () => {
    it('wraps payment.deleteById + debt.save + pool.applyDelta in one transaction', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        amount: 100,
        remainingAmount: 60,
      });
      const payment = buildPayment({
        debtLoanId: debt.id,
        amount: 40,
        currency: Currency.PEN,
      });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(paymentRepo.deleteById).toHaveBeenCalledWith(payment.id, FAKE_MGR);
      expect(debtRepo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, 40, FAKE_MGR);
    });

    it('propagates the error if deleteById fails', async () => {
      const debt = buildDebtLoan({ userId: USER, amount: 100, remainingAmount: 60 });
      const payment = buildPayment({ debtLoanId: debt.id, amount: 40, currency: null });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);
      paymentRepo.deleteById.mockRejectedValueOnce(new Error('db down'));

      await expect(useCase.execute(payment.id, USER)).rejects.toThrow('db down');
    });
  });

  describe('concurrency (lost update)', () => {
    it('reads payment and debt INSIDE the transaction, passing the tx manager so both reads are locked', async () => {
      const debt = buildDebtLoan({ userId: USER, amount: 100, remainingAmount: 60 });
      const payment = buildPayment({ debtLoanId: debt.id, amount: 40, currency: Currency.PEN });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER);

      // Without the locks, two concurrent deletes of the same payment both
      // read it as present and each credits payment.amount back to the pool.
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(paymentRepo.findById).toHaveBeenCalledWith(payment.id, FAKE_MGR);
      expect(debtRepo.findById).toHaveBeenCalledWith(debt.id, FAKE_MGR);
    });

    it('runs the payment-not-found guard from inside the transaction', async () => {
      // Exactly what a concurrent delete that committed first looks like: the
      // locked re-read finds nothing.
      paymentRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute('gone', USER)).rejects.toMatchObject({
        code: 'DEBT_LOAN_PAYMENT_NOT_FOUND',
      } satisfies Partial<DomainException>);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(pool.applyDelta).not.toHaveBeenCalled();
    });
  });
});
