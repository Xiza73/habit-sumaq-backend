import { randomUUID } from 'node:crypto';

import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';

import { buildDebtLoan } from '../../../domain/__tests__/debt-loan.factory';
import { type DebtLoanRepository } from '../../../domain/debt-loan.repository';
import { DebtLoanPayment } from '../../../domain/debt-loan-payment.entity';
import { type DebtLoanPaymentRepository } from '../../../domain/debt-loan-payment.repository';
import { ListDebtLoanPaymentsUseCase } from '../list-debt-loan-payments.use-case';

describe('ListDebtLoanPaymentsUseCase', () => {
  let debtRepo: jest.Mocked<DebtLoanRepository>;
  let paymentRepo: jest.Mocked<DebtLoanPaymentRepository>;
  let useCase: ListDebtLoanPaymentsUseCase;

  const USER = 'user-1';

  beforeEach(() => {
    debtRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      aggregateByReference: jest.fn(),
      findPendingByNormalizedReference: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    paymentRepo = {
      create: jest.fn(),
      findByDebtLoanId: jest.fn(),
    };
    useCase = new ListDebtLoanPaymentsUseCase(debtRepo, paymentRepo);
  });

  it('returns the payments of a debt ordered DESC by createdAt', async () => {
    const debt = buildDebtLoan({ userId: USER });
    debtRepo.findById.mockResolvedValue(debt);

    // Repo contract: rows already come back DESC by createdAt. The use
    // case forwards them as-is — this test asserts the contract is
    // honored end-to-end (most recent first).
    const newer = new DebtLoanPayment(
      randomUUID(),
      debt.id,
      30,
      Currency.PEN,
      null,
      new Date('2026-02-01T12:00:00.000Z'),
    );
    const older = new DebtLoanPayment(
      randomUUID(),
      debt.id,
      20,
      Currency.PEN,
      null,
      new Date('2026-01-15T12:00:00.000Z'),
    );
    paymentRepo.findByDebtLoanId.mockResolvedValue([newer, older]);

    const result = await useCase.execute(debt.id, USER);

    expect(paymentRepo.findByDebtLoanId).toHaveBeenCalledWith(debt.id);
    expect(result).toHaveLength(2);
    expect(result[0]?.createdAt.getTime()).toBeGreaterThan(result[1].createdAt.getTime());
    expect(result[0]).toBe(newer);
    expect(result[1]).toBe(older);
  });

  it('throws DEBT_LOAN_NOT_FOUND when the debt is missing', async () => {
    debtRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing', USER)).rejects.toMatchObject({
      code: 'DEBT_LOAN_NOT_FOUND',
    } satisfies Partial<DomainException>);
    expect(paymentRepo.findByDebtLoanId).not.toHaveBeenCalled();
  });

  it('throws DEBT_LOAN_NOT_FOUND when the debt is soft-deleted', async () => {
    debtRepo.findById.mockResolvedValue(buildDebtLoan({ userId: USER, deletedAt: new Date() }));

    await expect(useCase.execute('x', USER)).rejects.toMatchObject({
      code: 'DEBT_LOAN_NOT_FOUND',
    } satisfies Partial<DomainException>);
    expect(paymentRepo.findByDebtLoanId).not.toHaveBeenCalled();
  });

  it('throws DEBT_LOAN_BELONGS_TO_OTHER_USER on cross-user access', async () => {
    debtRepo.findById.mockResolvedValue(buildDebtLoan({ userId: 'someone-else' }));

    await expect(useCase.execute('x', USER)).rejects.toMatchObject({
      code: 'DEBT_LOAN_BELONGS_TO_OTHER_USER',
    } satisfies Partial<DomainException>);
    expect(paymentRepo.findByDebtLoanId).not.toHaveBeenCalled();
  });
});
