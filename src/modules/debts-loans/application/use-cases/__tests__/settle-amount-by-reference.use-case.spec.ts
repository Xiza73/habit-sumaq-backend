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
import { SettleAmountByReferenceUseCase } from '../settle-amount-by-reference.use-case';

describe('SettleAmountByReferenceUseCase', () => {
  let repo: jest.Mocked<DebtLoanRepository>;
  let paymentRepo: jest.Mocked<DebtLoanPaymentRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: SettleAmountByReferenceUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  const USER = 'user-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  beforeEach(() => {
    repo = {
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
      create: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      findByDebtLoanId: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn(),
    };
    pool = { applyDelta: jest.fn() } as unknown as jest.Mocked<CurrencyPoolService>;
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };
    logger = buildMockPinoLogger();
    useCase = new SettleAmountByReferenceUseCase(
      repo,
      paymentRepo,
      pool,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  it('throws DEBT_LOAN_REFERENCE_REQUIRED on whitespace-only reference', async () => {
    await expect(
      useCase.execute(USER, {
        reference: '   ',
        currency: Currency.PEN,
        type: DebtLoanType.DEBT,
        amount: 10,
      }),
    ).rejects.toMatchObject({
      code: 'DEBT_LOAN_REFERENCE_REQUIRED',
    } satisfies Partial<DomainException>);
    expect(repo.findPendingByReferenceCurrencyType).not.toHaveBeenCalled();
  });

  it('throws DEBT_LOAN_NO_PENDING_FOR_REFERENCE when nothing matches', async () => {
    repo.findPendingByReferenceCurrencyType.mockResolvedValue([]);

    await expect(
      useCase.execute(USER, {
        reference: 'Nobody',
        currency: Currency.PEN,
        type: DebtLoanType.DEBT,
        amount: 100,
      }),
    ).rejects.toMatchObject({
      code: 'DEBT_LOAN_NO_PENDING_FOR_REFERENCE',
    } satisfies Partial<DomainException>);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('forwards (reference, currency, type) to the repo FIFO lookup', async () => {
    repo.findPendingByReferenceCurrencyType.mockResolvedValue([
      buildDebtLoan({ userId: USER, type: DebtLoanType.LOAN, currency: Currency.USD }),
    ]);

    await useCase.execute(USER, {
      reference: 'Juan',
      currency: Currency.USD,
      type: DebtLoanType.LOAN,
      amount: 10,
    });

    expect(repo.findPendingByReferenceCurrencyType).toHaveBeenCalledWith(
      USER,
      'Juan',
      Currency.USD,
      DebtLoanType.LOAN,
    );
  });

  describe('FIFO distribution', () => {
    it('settles oldest-first: first two full, third partial', async () => {
      const d1 = buildDebtLoan({
        id: 'd1',
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        date: new Date('2026-01-01T00:00:00.000Z'),
        amount: 100,
        remainingAmount: 100,
      });
      const d2 = buildDebtLoan({
        id: 'd2',
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        date: new Date('2026-02-01T00:00:00.000Z'),
        amount: 50,
        remainingAmount: 50,
      });
      const d3 = buildDebtLoan({
        id: 'd3',
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        date: new Date('2026-03-01T00:00:00.000Z'),
        amount: 30,
        remainingAmount: 30,
      });
      // Repo returns oldest-first (its responsibility); use case consumes in order.
      repo.findPendingByReferenceCurrencyType.mockResolvedValue([d1, d2, d3]);

      const result = await useCase.execute(USER, {
        reference: 'Juan',
        currency: Currency.PEN,
        type: DebtLoanType.DEBT,
        amount: 170,
      });

      expect(d1.status).toBe(DebtLoanStatus.SETTLED);
      expect(d1.remainingAmount).toBe(0);
      expect(d2.status).toBe(DebtLoanStatus.SETTLED);
      expect(d2.remainingAmount).toBe(0);
      expect(d3.status).toBe(DebtLoanStatus.PENDING);
      expect(d3.remainingAmount).toBe(10);

      expect(result.settledCount).toBe(3);
      expect(result.fullySettledCount).toBe(2);
      expect(result.partiallySettledId).toBe('d3');
      expect(result.totalSettledAmount).toBe(170);
      expect(result.currency).toBe(Currency.PEN);
      expect(result.type).toBe(DebtLoanType.DEBT);

      // One payment row per touched debt, with the exact settled magnitude.
      expect(paymentRepo.create).toHaveBeenCalledTimes(3);
      expect(paymentRepo.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ debtLoanId: 'd1', amount: 100 }),
        FAKE_MGR,
      );
      expect(paymentRepo.create).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ debtLoanId: 'd3', amount: 20 }),
        FAKE_MGR,
      );
    });

    it('stops after the partial hit — untouched newer rows stay PENDING and get no payment row', async () => {
      const d1 = buildDebtLoan({
        id: 'd1',
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        remainingAmount: 40,
      });
      const d2 = buildDebtLoan({
        id: 'd2',
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        remainingAmount: 40,
      });
      repo.findPendingByReferenceCurrencyType.mockResolvedValue([d1, d2]);

      const result = await useCase.execute(USER, {
        reference: 'Juan',
        currency: Currency.PEN,
        type: DebtLoanType.DEBT,
        amount: 10,
      });

      expect(d1.remainingAmount).toBe(30);
      expect(d1.status).toBe(DebtLoanStatus.PENDING);
      expect(d2.remainingAmount).toBe(40);
      expect(result.settledCount).toBe(1);
      expect(result.fullySettledCount).toBe(0);
      expect(result.partiallySettledId).toBe('d1');
      expect(result.totalSettledAmount).toBe(10);
      expect(paymentRepo.create).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });

  it('amount == total settles all with no partial', async () => {
    const d1 = buildDebtLoan({ id: 'd1', userId: USER, remainingAmount: 100 });
    const d2 = buildDebtLoan({ id: 'd2', userId: USER, remainingAmount: 80 });
    repo.findPendingByReferenceCurrencyType.mockResolvedValue([d1, d2]);

    const result = await useCase.execute(USER, {
      reference: 'Juan',
      currency: Currency.PEN,
      type: DebtLoanType.DEBT,
      amount: 180,
    });

    expect(result.settledCount).toBe(2);
    expect(result.fullySettledCount).toBe(2);
    expect(result.partiallySettledId).toBeNull();
    expect(result.totalSettledAmount).toBe(180);
  });

  it('amount > total caps at total — settles all, no error, ignores leftover', async () => {
    const d1 = buildDebtLoan({ id: 'd1', userId: USER, remainingAmount: 100 });
    const d2 = buildDebtLoan({ id: 'd2', userId: USER, remainingAmount: 80 });
    repo.findPendingByReferenceCurrencyType.mockResolvedValue([d1, d2]);

    const result = await useCase.execute(USER, {
      reference: 'Juan',
      currency: Currency.PEN,
      type: DebtLoanType.DEBT,
      amount: 250,
    });

    expect(result.settledCount).toBe(2);
    expect(result.fullySettledCount).toBe(2);
    expect(result.totalSettledAmount).toBe(180);
    expect(result.partiallySettledId).toBeNull();
  });

  describe('pool movement', () => {
    it('real-payment DEBT: debits the pool by the total settled (negative net)', async () => {
      const d1 = buildDebtLoan({
        id: 'd1',
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        remainingAmount: 100,
      });
      const d2 = buildDebtLoan({
        id: 'd2',
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        remainingAmount: 60,
      });
      repo.findPendingByReferenceCurrencyType.mockResolvedValue([d1, d2]);

      await useCase.execute(USER, {
        reference: 'Juan',
        currency: Currency.PEN,
        type: DebtLoanType.DEBT,
        amount: 130,
        realPayment: true,
      });

      // 100 (full) + 30 (partial) = 130 settled, DEBT debits → -130.
      expect(pool.applyDelta).toHaveBeenCalledTimes(1);
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -130, FAKE_MGR);
      // Payment rows carry the currency in real-payment mode.
      expect(paymentRepo.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ currency: Currency.PEN }),
        FAKE_MGR,
      );
    });

    it('real-payment LOAN: credits the pool by the total settled (positive net)', async () => {
      const l1 = buildDebtLoan({
        id: 'l1',
        userId: USER,
        type: DebtLoanType.LOAN,
        currency: Currency.PEN,
        remainingAmount: 40,
      });
      repo.findPendingByReferenceCurrencyType.mockResolvedValue([l1]);

      await useCase.execute(USER, {
        reference: 'Juan',
        currency: Currency.PEN,
        type: DebtLoanType.LOAN,
        amount: 40,
        realPayment: true,
      });

      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, 40, FAKE_MGR);
    });

    it('informal-close: never touches the pool and payment rows carry null currency', async () => {
      const d1 = buildDebtLoan({
        id: 'd1',
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        remainingAmount: 100,
      });
      repo.findPendingByReferenceCurrencyType.mockResolvedValue([d1]);

      await useCase.execute(USER, {
        reference: 'Juan',
        currency: Currency.PEN,
        type: DebtLoanType.DEBT,
        amount: 50,
      });

      expect(pool.applyDelta).not.toHaveBeenCalled();
      expect(paymentRepo.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ currency: null }),
        FAKE_MGR,
      );
    });
  });

  it('computes money in exact cents (no float drift)', async () => {
    const d1 = buildDebtLoan({ id: 'd1', userId: USER, remainingAmount: 0.1 });
    const d2 = buildDebtLoan({ id: 'd2', userId: USER, remainingAmount: 0.2 });
    const d3 = buildDebtLoan({ id: 'd3', userId: USER, remainingAmount: 0.1 });
    repo.findPendingByReferenceCurrencyType.mockResolvedValue([d1, d2, d3]);

    const result = await useCase.execute(USER, {
      reference: 'Juan',
      currency: Currency.PEN,
      type: DebtLoanType.DEBT,
      amount: 0.35,
      realPayment: true,
    });

    // 0.10 + 0.20 + 0.05 = 0.35 exactly (would drift as raw floats).
    expect(result.totalSettledAmount).toBe(0.35);
    expect(result.fullySettledCount).toBe(2);
    expect(result.partiallySettledId).toBe('d3');
    expect(d3.remainingAmount).toBe(0.05);
    expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -0.35, FAKE_MGR);
  });

  it('forwards the transactional EntityManager to every write', async () => {
    const d1 = buildDebtLoan({ id: 'd1', userId: USER, remainingAmount: 100 });
    repo.findPendingByReferenceCurrencyType.mockResolvedValue([d1]);

    await useCase.execute(USER, {
      reference: 'Juan',
      currency: Currency.PEN,
      type: DebtLoanType.DEBT,
      amount: 100,
      realPayment: true,
    });

    expect(repo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
    expect(paymentRepo.create).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
  });

  it('defensively rejects cross-user rows that leak through the repo', async () => {
    repo.findPendingByReferenceCurrencyType.mockResolvedValue([
      buildDebtLoan({ userId: 'someone-else' }),
    ]);

    await expect(
      useCase.execute(USER, {
        reference: 'Juan',
        currency: Currency.PEN,
        type: DebtLoanType.DEBT,
        amount: 100,
      }),
    ).rejects.toMatchObject({
      code: 'DEBT_LOAN_BELONGS_TO_OTHER_USER',
    } satisfies Partial<DomainException>);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('logs a summary event with the settle outcome', async () => {
    const d1 = buildDebtLoan({
      id: 'd1',
      userId: USER,
      type: DebtLoanType.LOAN,
      currency: Currency.PEN,
      remainingAmount: 25,
    });
    repo.findPendingByReferenceCurrencyType.mockResolvedValue([d1]);

    await useCase.execute(USER, {
      reference: 'Juan',
      currency: Currency.PEN,
      type: DebtLoanType.LOAN,
      amount: 25,
      realPayment: true,
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'debt_loan.settled_amount_by_reference',
        settledCount: 1,
        fullySettledCount: 1,
        totalSettledAmount: 25,
        netPoolDelta: 25,
      }),
      'debt_loan.settled_amount_by_reference',
    );
  });
});
