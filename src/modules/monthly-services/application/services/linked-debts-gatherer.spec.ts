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
  let paymentRepo: jest.Mocked<Pick<MonthlyServicePaymentRepository, 'findByServiceId'>>;
  let debtLoanRepo: jest.Mocked<Pick<DebtLoanRepository, 'findBySourcePaymentIds'>>;
  let gatherer: LinkedDebtsGatherer;

  beforeEach(() => {
    paymentRepo = { findByServiceId: jest.fn() };
    debtLoanRepo = { findBySourcePaymentIds: jest.fn().mockResolvedValue([]) };
    gatherer = new LinkedDebtsGatherer(
      paymentRepo as unknown as MonthlyServicePaymentRepository,
      debtLoanRepo as unknown as DebtLoanRepository,
    );
  });

  it('returns an empty array when the service has no payments (no wasted round-trip)', async () => {
    paymentRepo.findByServiceId.mockResolvedValue([]);

    const result = await gatherer.forService('service-1');

    expect(result).toEqual([]);
    expect(debtLoanRepo.findBySourcePaymentIds).not.toHaveBeenCalled();
  });

  it('gathers PENDING linked debts across all of the service payments', async () => {
    paymentRepo.findByServiceId.mockResolvedValue([
      buildPayment({ id: 'payment-1' }),
      buildPayment({ id: 'payment-2' }),
    ]);
    debtLoanRepo.findBySourcePaymentIds.mockResolvedValue([
      buildDebt({ id: 'debt-1', reference: 'Ana', remainingAmount: 100 }),
      buildDebt({ id: 'debt-2', reference: 'Luis', remainingAmount: 80 }),
    ]);

    const result = await gatherer.forService('service-1');

    expect(debtLoanRepo.findBySourcePaymentIds).toHaveBeenCalledWith(['payment-1', 'payment-2']);
    expect(result).toEqual([
      { id: 'debt-1', reference: 'Ana', remainingAmount: 100, status: 'PENDING' },
      { id: 'debt-2', reference: 'Luis', remainingAmount: 80, status: 'PENDING' },
    ]);
  });

  it('excludes SETTLED linked debts from the result (only PENDING surfaces)', async () => {
    paymentRepo.findByServiceId.mockResolvedValue([buildPayment({ id: 'payment-1' })]);
    debtLoanRepo.findBySourcePaymentIds.mockResolvedValue([
      buildDebt({ id: 'debt-1', reference: 'Ana', status: DebtLoanStatus.SETTLED }),
      buildDebt({ id: 'debt-2', reference: 'Luis', status: DebtLoanStatus.PENDING }),
    ]);

    const result = await gatherer.forService('service-1');

    expect(result).toEqual([
      { id: 'debt-2', reference: 'Luis', remainingAmount: 100, status: 'PENDING' },
    ]);
  });
});
