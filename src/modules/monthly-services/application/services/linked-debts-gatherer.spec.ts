import { randomUUID } from 'node:crypto';

import { Currency } from '@common/enums/currency.enum';
import { DebtLoan } from '@modules/debts-loans/domain/debt-loan.entity';
import { type DebtLoanRepository } from '@modules/debts-loans/domain/debt-loan.repository';
import { DebtLoanStatus } from '@modules/debts-loans/domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '@modules/debts-loans/domain/enums/debt-loan-type.enum';
import { type MonthlyServicePayment } from '@modules/monthly-service-payments/domain/monthly-service-payment.entity';
import { type MonthlyServicePaymentRepository } from '@modules/monthly-service-payments/domain/monthly-service-payment.repository';

import { LinkedDebtsGatherer } from './linked-debts-gatherer';

function buildPayment(overrides: Partial<{ id: string; monthlyServiceId: string }> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    monthlyServiceId: overrides.monthlyServiceId ?? 'service-1',
  } as MonthlyServicePayment;
}

function buildLinkedDebtWithSource(
  overrides: Partial<{
    id: string;
    reference: string;
    remainingAmount: number;
    status: DebtLoanStatus;
    sourceMonthlyServicePaymentId: string;
  }> = {},
): DebtLoan {
  return buildDebt(overrides);
}

function buildDebt(
  overrides: Partial<{
    id: string;
    reference: string;
    remainingAmount: number;
    status: DebtLoanStatus;
    sourceMonthlyServicePaymentId: string;
  }> = {},
): DebtLoan {
  const now = new Date('2026-06-01T00:00:00.000Z');
  const amount = overrides.remainingAmount ?? 100;
  return new DebtLoan(
    overrides.id ?? randomUUID(),
    'user-1',
    DebtLoanType.LOAN,
    null,
    Currency.PEN,
    amount,
    amount,
    overrides.status ?? DebtLoanStatus.PENDING,
    overrides.reference ?? 'Ana',
    null,
    now,
    now,
    now,
    null,
    overrides.sourceMonthlyServicePaymentId ?? 'payment-1',
  );
}

describe('LinkedDebtsGatherer', () => {
  let paymentRepo: jest.Mocked<
    Pick<MonthlyServicePaymentRepository, 'findByServiceId' | 'findByServiceIds'>
  >;
  let debtLoanRepo: jest.Mocked<Pick<DebtLoanRepository, 'findBySourcePaymentIds'>>;
  let gatherer: LinkedDebtsGatherer;

  beforeEach(() => {
    paymentRepo = { findByServiceId: jest.fn(), findByServiceIds: jest.fn().mockResolvedValue([]) };
    debtLoanRepo = { findBySourcePaymentIds: jest.fn().mockResolvedValue([]) };
    gatherer = new LinkedDebtsGatherer(
      paymentRepo as unknown as MonthlyServicePaymentRepository,
      debtLoanRepo as unknown as DebtLoanRepository,
    );
  });

  describe('forService (single)', () => {
    it('returns an empty array when the service has no payments (no wasted round-trip)', async () => {
      paymentRepo.findByServiceIds.mockResolvedValue([]);

      const result = await gatherer.forService('service-1');

      expect(result).toEqual([]);
      expect(debtLoanRepo.findBySourcePaymentIds).not.toHaveBeenCalled();
    });

    it('gathers PENDING linked debts across all of the service payments', async () => {
      paymentRepo.findByServiceIds.mockResolvedValue([
        buildPayment({ id: 'payment-1', monthlyServiceId: 'service-1' }),
        buildPayment({ id: 'payment-2', monthlyServiceId: 'service-1' }),
      ]);
      debtLoanRepo.findBySourcePaymentIds.mockResolvedValue([
        buildLinkedDebtWithSource({
          id: 'debt-1',
          reference: 'Ana',
          remainingAmount: 100,
          sourceMonthlyServicePaymentId: 'payment-1',
        }),
        buildLinkedDebtWithSource({
          id: 'debt-2',
          reference: 'Luis',
          remainingAmount: 80,
          sourceMonthlyServicePaymentId: 'payment-2',
        }),
      ]);

      const result = await gatherer.forService('service-1');

      expect(debtLoanRepo.findBySourcePaymentIds).toHaveBeenCalledWith(['payment-1', 'payment-2']);
      expect(result).toEqual([
        { id: 'debt-1', reference: 'Ana', remainingAmount: 100, status: 'PENDING' },
        { id: 'debt-2', reference: 'Luis', remainingAmount: 80, status: 'PENDING' },
      ]);
    });

    it('excludes SETTLED linked debts from the result (only PENDING surfaces)', async () => {
      paymentRepo.findByServiceIds.mockResolvedValue([
        buildPayment({ id: 'payment-1', monthlyServiceId: 'service-1' }),
      ]);
      debtLoanRepo.findBySourcePaymentIds.mockResolvedValue([
        buildLinkedDebtWithSource({
          id: 'debt-1',
          reference: 'Ana',
          status: DebtLoanStatus.SETTLED,
          sourceMonthlyServicePaymentId: 'payment-1',
        }),
        buildLinkedDebtWithSource({
          id: 'debt-2',
          reference: 'Luis',
          status: DebtLoanStatus.PENDING,
          sourceMonthlyServicePaymentId: 'payment-1',
        }),
      ]);

      const result = await gatherer.forService('service-1');

      expect(result).toEqual([
        { id: 'debt-2', reference: 'Luis', remainingAmount: 100, status: 'PENDING' },
      ]);
    });
  });

  describe('forServices (batched — no N+1)', () => {
    it('returns an empty map without querying debts when no service has payments', async () => {
      paymentRepo.findByServiceIds.mockResolvedValue([]);

      const result = await gatherer.forServices(['service-1', 'service-2']);

      expect(result).toEqual(new Map());
      expect(debtLoanRepo.findBySourcePaymentIds).not.toHaveBeenCalled();
    });

    it('returns an empty map for an empty serviceIds list (no round-trips at all)', async () => {
      const result = await gatherer.forServices([]);

      expect(result).toEqual(new Map());
      expect(paymentRepo.findByServiceIds).not.toHaveBeenCalled();
      expect(debtLoanRepo.findBySourcePaymentIds).not.toHaveBeenCalled();
    });

    it('issues at most TWO queries for N services (proves no N+1 fan-out)', async () => {
      paymentRepo.findByServiceIds.mockResolvedValue([
        buildPayment({ id: 'payment-1', monthlyServiceId: 'service-1' }),
        buildPayment({ id: 'payment-2', monthlyServiceId: 'service-2' }),
        buildPayment({ id: 'payment-3', monthlyServiceId: 'service-3' }),
      ]);
      debtLoanRepo.findBySourcePaymentIds.mockResolvedValue([]);

      await gatherer.forServices(['service-1', 'service-2', 'service-3']);

      // The whole point of the batch: ONE payments fetch + ONE debts fetch,
      // regardless of how many services are in the list. Anything more is the
      // N+1 regression this method exists to kill.
      expect(paymentRepo.findByServiceIds).toHaveBeenCalledTimes(1);
      expect(paymentRepo.findByServiceIds).toHaveBeenCalledWith([
        'service-1',
        'service-2',
        'service-3',
      ]);
      expect(debtLoanRepo.findBySourcePaymentIds).toHaveBeenCalledTimes(1);
      expect(debtLoanRepo.findBySourcePaymentIds).toHaveBeenCalledWith([
        'payment-1',
        'payment-2',
        'payment-3',
      ]);
    });

    it('groups each PENDING debt back to its own service via the payment→service map', async () => {
      paymentRepo.findByServiceIds.mockResolvedValue([
        buildPayment({ id: 'payment-1', monthlyServiceId: 'service-1' }),
        buildPayment({ id: 'payment-2', monthlyServiceId: 'service-2' }),
      ]);
      debtLoanRepo.findBySourcePaymentIds.mockResolvedValue([
        buildLinkedDebtWithSource({
          id: 'debt-1',
          reference: 'Ana',
          remainingAmount: 100,
          sourceMonthlyServicePaymentId: 'payment-1',
        }),
        buildLinkedDebtWithSource({
          id: 'debt-2',
          reference: 'Luis',
          remainingAmount: 80,
          sourceMonthlyServicePaymentId: 'payment-2',
        }),
        // A SETTLED debt on service-2 must be dropped, not grouped.
        buildLinkedDebtWithSource({
          id: 'debt-3',
          reference: 'Mia',
          status: DebtLoanStatus.SETTLED,
          sourceMonthlyServicePaymentId: 'payment-2',
        }),
      ]);

      const result = await gatherer.forServices(['service-1', 'service-2', 'service-3']);

      expect(result.get('service-1')).toEqual([
        { id: 'debt-1', reference: 'Ana', remainingAmount: 100, status: 'PENDING' },
      ]);
      expect(result.get('service-2')).toEqual([
        { id: 'debt-2', reference: 'Luis', remainingAmount: 80, status: 'PENDING' },
      ]);
      // Services with no PENDING linked debts are absent from the map — callers
      // treat a missing key as an empty array.
      expect(result.has('service-3')).toBe(false);
    });
  });
});
