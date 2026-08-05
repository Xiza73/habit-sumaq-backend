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
import { BulkSettleByReferenceUseCase } from '../bulk-settle-by-reference.use-case';

describe('BulkSettleByReferenceUseCase', () => {
  let repo: jest.Mocked<DebtLoanRepository>;
  let paymentRepo: jest.Mocked<DebtLoanPaymentRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: BulkSettleByReferenceUseCase;
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
    useCase = new BulkSettleByReferenceUseCase(
      repo,
      paymentRepo,
      pool,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  it('throws DEBT_LOAN_REFERENCE_REQUIRED on whitespace-only reference', async () => {
    await expect(useCase.execute(USER, { reference: '   ' })).rejects.toMatchObject({
      code: 'DEBT_LOAN_REFERENCE_REQUIRED',
    } satisfies Partial<DomainException>);
  });

  it('returns settledCount=0 when nothing matches (NOT an error)', async () => {
    repo.findPendingByNormalizedReference.mockResolvedValue([]);

    const result = await useCase.execute(USER, { reference: 'Nobody' });

    expect(result.settledCount).toBe(0);
    expect(result.totalSettledAmount).toBe(0);
    expect(result.settledIds).toEqual([]);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  describe('informal-close mode', () => {
    it('settles all matching rows without touching pool', async () => {
      const a = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        amount: 100,
        remainingAmount: 100,
      });
      const b = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.LOAN,
        currency: Currency.USD,
        amount: 50,
        remainingAmount: 50,
      });
      repo.findPendingByNormalizedReference.mockResolvedValue([a, b]);

      const result = await useCase.execute(USER, { reference: 'Juan' });

      expect(result.settledCount).toBe(2);
      expect(result.totalSettledAmount).toBe(150);
      expect(result.currency).toBeNull();
      expect(result.settledIds).toEqual([a.id, b.id]);
      expect(pool.applyDelta).not.toHaveBeenCalled();
      expect(a.status).toBe(DebtLoanStatus.SETTLED);
      expect(b.status).toBe(DebtLoanStatus.SETTLED);
    });
  });

  describe('real-payment mode', () => {
    it('applies net pool delta for PEN bulk: -DEBTs +LOANs', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        remainingAmount: 80,
      });
      const loan = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.LOAN,
        currency: Currency.PEN,
        remainingAmount: 30,
      });
      repo.findPendingByNormalizedReference.mockResolvedValue([debt, loan]);

      const result = await useCase.execute(USER, {
        reference: 'Juan',
        currency: Currency.PEN,
      });

      // Net: -80 (paid debt) + 30 (collected loan) = -50.
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -50, FAKE_MGR);
      expect(result.totalSettledAmount).toBe(110);
      expect(result.currency).toBe(Currency.PEN);
      expect(result.settledCount).toBe(2);
    });

    it('skips pool.applyDelta when net delta is exactly 0', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        remainingAmount: 50,
      });
      const loan = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.LOAN,
        currency: Currency.PEN,
        remainingAmount: 50,
      });
      repo.findPendingByNormalizedReference.mockResolvedValue([debt, loan]);

      await useCase.execute(USER, { reference: 'Juan', currency: Currency.PEN });

      expect(pool.applyDelta).not.toHaveBeenCalled();
    });

    it('forwards the EntityManager to every repo.save call', async () => {
      const row = buildDebtLoan({
        userId: USER,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        remainingAmount: 100,
      });
      repo.findPendingByNormalizedReference.mockResolvedValue([row]);

      await useCase.execute(USER, { reference: 'Juan', currency: Currency.PEN });

      expect(repo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
    });

    it('forwards currency to the repo findPending lookup', async () => {
      repo.findPendingByNormalizedReference.mockResolvedValue([]);
      await useCase.execute(USER, { reference: 'Juan', currency: Currency.USD });
      expect(repo.findPendingByNormalizedReference).toHaveBeenCalledWith(
        USER,
        'Juan',
        Currency.USD,
      );
    });
  });

  it('defensively rejects cross-user rows that somehow leak through the repo', async () => {
    const row = buildDebtLoan({ userId: 'someone-else' });
    repo.findPendingByNormalizedReference.mockResolvedValue([row]);

    await expect(useCase.execute(USER, { reference: 'Juan' })).rejects.toMatchObject({
      code: 'DEBT_LOAN_BELONGS_TO_OTHER_USER',
    } satisfies Partial<DomainException>);
  });

  it('inserts one payment row per settled debt inside the same tx', async () => {
    const a = buildDebtLoan({
      userId: USER,
      type: DebtLoanType.DEBT,
      currency: Currency.PEN,
      remainingAmount: 40,
    });
    const b = buildDebtLoan({
      userId: USER,
      type: DebtLoanType.LOAN,
      currency: Currency.PEN,
      remainingAmount: 60,
    });
    const c = buildDebtLoan({
      userId: USER,
      type: DebtLoanType.DEBT,
      currency: Currency.PEN,
      remainingAmount: 25,
    });
    repo.findPendingByNormalizedReference.mockResolvedValue([a, b, c]);

    await useCase.execute(USER, { reference: 'Juan', currency: Currency.PEN });

    expect(paymentRepo.create).toHaveBeenCalledTimes(3);
    expect(paymentRepo.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ debtLoanId: a.id, amount: 40, currency: Currency.PEN, note: null }),
      FAKE_MGR,
    );
    expect(paymentRepo.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ debtLoanId: b.id, amount: 60, currency: Currency.PEN, note: null }),
      FAKE_MGR,
    );
    expect(paymentRepo.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ debtLoanId: c.id, amount: 25, currency: Currency.PEN, note: null }),
      FAKE_MGR,
    );
  });

  it('logs with settledCount + netPoolDelta', async () => {
    const row = buildDebtLoan({
      userId: USER,
      type: DebtLoanType.LOAN,
      currency: Currency.PEN,
      remainingAmount: 25,
    });
    repo.findPendingByNormalizedReference.mockResolvedValue([row]);

    await useCase.execute(USER, { reference: 'Juan', currency: Currency.PEN });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'debt_loan.bulk_settled',
        settledCount: 1,
        netPoolDelta: 25,
      }),
      'debt_loan.bulk_settled',
    );
  });
});
