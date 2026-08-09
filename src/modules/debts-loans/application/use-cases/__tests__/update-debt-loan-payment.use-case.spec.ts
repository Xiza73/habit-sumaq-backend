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
import { UpdateDebtLoanPaymentUseCase } from '../update-debt-loan-payment.use-case';

describe('UpdateDebtLoanPaymentUseCase', () => {
  let debtRepo: jest.Mocked<DebtLoanRepository>;
  let paymentRepo: jest.Mocked<DebtLoanPaymentRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: UpdateDebtLoanPaymentUseCase;
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
    }> = {},
  ): DebtLoanPayment {
    return new DebtLoanPayment(
      overrides.id ?? randomUUID(),
      overrides.debtLoanId ?? randomUUID(),
      overrides.amount ?? 40,
      overrides.currency ?? null,
      overrides.note ?? null,
      overrides.createdAt ?? new Date('2026-02-01T12:00:00.000Z'),
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
      update: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      deleteById: jest.fn(),
    };
    pool = { applyDelta: jest.fn() } as unknown as jest.Mocked<CurrencyPoolService>;
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };
    logger = buildMockPinoLogger();
    useCase = new UpdateDebtLoanPaymentUseCase(
      debtRepo,
      paymentRepo,
      pool,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  describe('guards', () => {
    it('throws DEBT_LOAN_PAYMENT_UPDATE_NO_FIELDS when no fields are sent', async () => {
      await expect(useCase.execute('p', USER, {})).rejects.toMatchObject({
        code: 'DEBT_LOAN_PAYMENT_UPDATE_NO_FIELDS',
      } satisfies Partial<DomainException>);
      expect(paymentRepo.findById).not.toHaveBeenCalled();
    });

    it('throws DEBT_LOAN_PAYMENT_NOT_FOUND when the payment does not exist', async () => {
      paymentRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute('p', USER, { amount: 10 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_PAYMENT_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws DEBT_LOAN_NOT_FOUND when the parent debt is missing', async () => {
      paymentRepo.findById.mockResolvedValue(buildPayment());
      debtRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute('p', USER, { amount: 10 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws DEBT_LOAN_NOT_FOUND when the parent debt is soft-deleted', async () => {
      paymentRepo.findById.mockResolvedValue(buildPayment());
      debtRepo.findById.mockResolvedValue(buildDebtLoan({ userId: USER, deletedAt: new Date() }));
      await expect(useCase.execute('p', USER, { amount: 10 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws DEBT_LOAN_BELONGS_TO_OTHER_USER on cross-user edit', async () => {
      paymentRepo.findById.mockResolvedValue(buildPayment());
      debtRepo.findById.mockResolvedValue(buildDebtLoan({ userId: 'someone-else' }));
      await expect(useCase.execute('p', USER, { amount: 10 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_BELONGS_TO_OTHER_USER',
      } satisfies Partial<DomainException>);
    });
  });

  describe('amount up — pays more (remaining goes down)', () => {
    it('flips status to SETTLED when remaining hits zero', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        amount: 100,
        remainingAmount: 30,
        status: DebtLoanStatus.PENDING,
      });
      // oldAmount = 70 → with remaining=30, total payments so far = 70.
      const payment = buildPayment({ debtLoanId: debt.id, amount: 70, currency: null });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER, { amount: 100 });

      expect(debt.remainingAmount).toBe(0);
      expect(debt.status).toBe(DebtLoanStatus.SETTLED);
      expect(debtRepo.save).toHaveBeenCalledWith(debt, FAKE_MGR);
      expect(paymentRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: payment.id, amount: 100 }),
        FAKE_MGR,
      );
    });
  });

  describe('amount down on a SETTLED debt — reopens to PENDING', () => {
    it('reduces amount on a SETTLED row → status reopens to PENDING with remaining > 0', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        amount: 100,
        remainingAmount: 0,
        status: DebtLoanStatus.SETTLED,
      });
      const payment = buildPayment({ debtLoanId: debt.id, amount: 100, currency: null });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER, { amount: 60 });

      // delta = 60 - 100 = -40 → remaining = 0 - (-40) = 40
      expect(debt.remainingAmount).toBe(40);
      expect(debt.status).toBe(DebtLoanStatus.PENDING);
    });
  });

  describe('note-only edit', () => {
    it('does not touch remainingAmount, status, or pool', async () => {
      const debt = buildDebtLoan({ userId: USER, amount: 100, remainingAmount: 60 });
      const payment = buildPayment({ debtLoanId: debt.id, amount: 40, currency: Currency.PEN });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      const result = await useCase.execute(payment.id, USER, { note: 'Yape' });

      expect(result.note).toBe('Yape');
      expect(result.amount).toBe(40);
      expect(debt.remainingAmount).toBe(60);
      expect(debtRepo.save).not.toHaveBeenCalled();
      expect(pool.applyDelta).not.toHaveBeenCalled();
    });

    it('accepts null to clear an existing note', async () => {
      const debt = buildDebtLoan({ userId: USER });
      const payment = buildPayment({
        debtLoanId: debt.id,
        amount: 40,
        currency: null,
        note: 'old note',
      });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      const result = await useCase.execute(payment.id, USER, { note: null });

      expect(result.note).toBeNull();
    });
  });

  describe('real-payment mode — pool delta reversal', () => {
    it('DEBT: amount up applies negative net delta to pool (more pago)', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        amount: 100,
        remainingAmount: 60,
      });
      // oldAmount = 40 → newAmount = 70 → delta = +30 → pool DEBT = -30.
      const payment = buildPayment({
        debtLoanId: debt.id,
        amount: 40,
        currency: Currency.PEN,
      });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER, { amount: 70 });

      expect(pool.applyDelta).toHaveBeenCalledTimes(1);
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -30, FAKE_MGR);
    });

    it('LOAN: amount up applies positive net delta to pool (more cobro)', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.LOAN,
        currency: Currency.USD,
        amount: 200,
        remainingAmount: 120,
      });
      // oldAmount = 80 → newAmount = 100 → delta = +20 → pool LOAN = +20.
      const payment = buildPayment({
        debtLoanId: debt.id,
        amount: 80,
        currency: Currency.USD,
      });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER, { amount: 100 });

      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.USD, 20, FAKE_MGR);
    });

    it('DEBT: amount down applies positive net delta (we undo part of the pago)', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        amount: 100,
        remainingAmount: 30,
      });
      // oldAmount = 70 → newAmount = 50 → delta = -20 → pool DEBT = +20.
      const payment = buildPayment({
        debtLoanId: debt.id,
        amount: 70,
        currency: Currency.PEN,
      });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER, { amount: 50 });

      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, 20, FAKE_MGR);
      expect(debt.remainingAmount).toBe(50);
      expect(debt.status).toBe(DebtLoanStatus.PENDING);
    });

    it('does not touch the pool when amount is unchanged (note-only edit on real-payment)', async () => {
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

      await useCase.execute(payment.id, USER, { note: 'just a note' });

      expect(pool.applyDelta).not.toHaveBeenCalled();
    });
  });

  describe('overpayment guard', () => {
    it('throws DEBT_LOAN_SETTLEMENT_EXCEEDS_REMAINING when newAmount would leave remaining < 0', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        amount: 100,
        remainingAmount: 30,
      });
      const payment = buildPayment({ debtLoanId: debt.id, amount: 70 });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await expect(useCase.execute(payment.id, USER, { amount: 150 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_SETTLEMENT_EXCEEDS_REMAINING',
      } satisfies Partial<DomainException>);
      expect(debtRepo.save).not.toHaveBeenCalled();
      expect(paymentRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('transactionality', () => {
    it('wraps payment.update + debt.save + pool.applyDelta in one transaction', async () => {
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

      await useCase.execute(payment.id, USER, { amount: 50 });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(paymentRepo.update).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
      expect(debtRepo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -10, FAKE_MGR);
    });

    it('propagates the error if paymentRepo.update fails (caller will see rollback)', async () => {
      const debt = buildDebtLoan({ userId: USER, amount: 100, remainingAmount: 60 });
      const payment = buildPayment({ debtLoanId: debt.id, amount: 40, currency: null });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);
      paymentRepo.update.mockRejectedValueOnce(new Error('db down'));

      await expect(useCase.execute(payment.id, USER, { amount: 50 })).rejects.toThrow('db down');
    });
  });

  describe('concurrency (lost update)', () => {
    it('reads payment and debt INSIDE the transaction, passing the tx manager so both reads are locked', async () => {
      const debt = buildDebtLoan({ userId: USER, amount: 100, remainingAmount: 60 });
      const payment = buildPayment({ debtLoanId: debt.id, amount: 40, currency: Currency.PEN });
      paymentRepo.findById.mockResolvedValue(payment);
      debtRepo.findById.mockResolvedValue(debt);

      await useCase.execute(payment.id, USER, { amount: 50 });

      // The amount math is a read-modify-write on debt.remainingAmount whose
      // delta moves the pool — it has to run against the locked row.
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(paymentRepo.findById).toHaveBeenCalledWith(payment.id, FAKE_MGR);
      expect(debtRepo.findById).toHaveBeenCalledWith(debt.id, FAKE_MGR);
    });

    it('runs the payment-not-found guard from inside the transaction', async () => {
      paymentRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute('gone', USER, { amount: 50 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_PAYMENT_NOT_FOUND',
      } satisfies Partial<DomainException>);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(pool.applyDelta).not.toHaveBeenCalled();
    });

    it('rejects the no-fields DTO without opening a transaction', async () => {
      // Pure DTO validation — no row to lock, so it must stay outside the tx
      // rather than paying for a connection and a lock to fail on shape.
      await expect(useCase.execute('x', USER, {})).rejects.toMatchObject({
        code: 'DEBT_LOAN_PAYMENT_UPDATE_NO_FIELDS',
      } satisfies Partial<DomainException>);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(paymentRepo.findById).not.toHaveBeenCalled();
    });
  });
});
