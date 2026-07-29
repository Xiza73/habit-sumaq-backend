import { type EntityManager } from 'typeorm';

import { Currency } from '@common/enums/currency.enum';
import { type CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { type DebtLoanRepository } from '../../domain/debt-loan.repository';
import { type DebtLoanPaymentRepository } from '../../domain/debt-loan-payment.repository';
import { DebtLoanStatus } from '../../domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

import { DebtLoanSettlementComposer } from './debt-loan-settlement-composer';

describe('DebtLoanSettlementComposer', () => {
  let repo: jest.Mocked<DebtLoanRepository>;
  let paymentRepo: jest.Mocked<DebtLoanPaymentRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let composer: DebtLoanSettlementComposer;

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

    composer = new DebtLoanSettlementComposer(repo, paymentRepo, pool);
  });

  describe('createLinked', () => {
    it('creates a PENDING LOAN via repo.save on the caller-supplied manager (no new tx opened)', async () => {
      const result = await composer.createLinked(FAKE_MGR, {
        userId: USER,
        reference: 'Ana',
        currency: Currency.PEN,
        amount: 100,
        sourceMonthlyServicePaymentId: 'payment-1',
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
      expect(result.type).toBe(DebtLoanType.LOAN);
      expect(result.status).toBe(DebtLoanStatus.PENDING);
      expect(result.amount).toBe(100);
      expect(result.remainingAmount).toBe(100);
      expect(result.reference).toBe('Ana');
      expect(result.currency).toBe(Currency.PEN);
      expect(result.sourceMonthlyServicePaymentId).toBe('payment-1');
    });

    it('never touches the pool or payment history (create is pool-neutral)', async () => {
      await composer.createLinked(FAKE_MGR, {
        userId: USER,
        reference: 'Luis',
        currency: Currency.USD,
        amount: 80,
        sourceMonthlyServicePaymentId: 'payment-2',
      });

      expect(pool.applyDelta).not.toHaveBeenCalled();
      expect(paymentRepo.create).not.toHaveBeenCalled();
    });

    it('creates a different LOAN for a different participant (triangulation)', async () => {
      const result = await composer.createLinked(FAKE_MGR, {
        userId: USER,
        reference: 'Carla',
        currency: Currency.EUR,
        amount: 45.5,
        sourceMonthlyServicePaymentId: 'payment-3',
      });

      expect(result.reference).toBe('Carla');
      expect(result.currency).toBe(Currency.EUR);
      expect(result.amount).toBe(45.5);
      expect(result.sourceMonthlyServicePaymentId).toBe('payment-3');
    });
  });

  describe('createAndSettleLinked', () => {
    it('creates the LOAN and immediately settles it in the SAME manager (no new tx)', async () => {
      const result = await composer.createAndSettleLinked(FAKE_MGR, {
        userId: USER,
        reference: 'Ana',
        currency: Currency.PEN,
        amount: 100,
        sourceMonthlyServicePaymentId: 'payment-1',
      });

      expect(result.status).toBe(DebtLoanStatus.SETTLED);
      expect(result.remainingAmount).toBe(0);
      // save() is called twice: once for create, once after applySettlement.
      expect(repo.save).toHaveBeenCalledTimes(2);
      expect(repo.save).toHaveBeenNthCalledWith(1, expect.anything(), FAKE_MGR);
      expect(repo.save).toHaveBeenNthCalledWith(2, expect.anything(), FAKE_MGR);
    });

    it('inserts a payment-history row on the same manager', async () => {
      await composer.createAndSettleLinked(FAKE_MGR, {
        userId: USER,
        reference: 'Ana',
        currency: Currency.PEN,
        amount: 100,
        sourceMonthlyServicePaymentId: 'payment-1',
      });

      expect(paymentRepo.create).toHaveBeenCalledTimes(1);
      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100, currency: Currency.PEN, note: null }),
        FAKE_MGR,
      );
    });

    it('applies a POSITIVE pool delta (LOAN settle = collect) on the same manager', async () => {
      await composer.createAndSettleLinked(FAKE_MGR, {
        userId: USER,
        reference: 'Ana',
        currency: Currency.PEN,
        amount: 100,
        sourceMonthlyServicePaymentId: 'payment-1',
      });

      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, 100, FAKE_MGR);
    });

    it('settles a different amount/currency correctly (triangulation)', async () => {
      const result = await composer.createAndSettleLinked(FAKE_MGR, {
        userId: USER,
        reference: 'Luis',
        currency: Currency.USD,
        amount: 37.25,
        sourceMonthlyServicePaymentId: 'payment-2',
      });

      expect(result.status).toBe(DebtLoanStatus.SETTLED);
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.USD, 37.25, FAKE_MGR);
    });
  });
});
