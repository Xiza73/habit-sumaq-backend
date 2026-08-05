import { type DomainException } from '@common/exceptions/domain.exception';

import { buildDebtLoan } from '../../../domain/__tests__/debt-loan.factory';
import { type DebtLoanRepository } from '../../../domain/debt-loan.repository';
import { DebtLoanStatus } from '../../../domain/enums/debt-loan-status.enum';
import { UpdateDebtLoanUseCase } from '../update-debt-loan.use-case';

describe('UpdateDebtLoanUseCase', () => {
  let repo: jest.Mocked<DebtLoanRepository>;
  let useCase: UpdateDebtLoanUseCase;

  const USER = 'user-1';

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
    useCase = new UpdateDebtLoanUseCase(repo);
  });

  describe('guards', () => {
    it('throws DEBT_LOAN_NOT_FOUND for missing id', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(useCase.execute('x', USER, { amount: 200 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws DEBT_LOAN_NOT_FOUND for soft-deleted row', async () => {
      repo.findById.mockResolvedValue(buildDebtLoan({ userId: USER, deletedAt: new Date() }));
      await expect(useCase.execute('x', USER, { amount: 200 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws DEBT_LOAN_BELONGS_TO_OTHER_USER on cross-user edit', async () => {
      repo.findById.mockResolvedValue(buildDebtLoan({ userId: 'other' }));
      await expect(useCase.execute('x', USER, { amount: 200 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_BELONGS_TO_OTHER_USER',
      } satisfies Partial<DomainException>);
    });
  });

  describe('SETTLED rows', () => {
    it('allows amount-only edit on a SETTLED row when ≥ already-settled', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        amount: 100,
        remainingAmount: 0,
        status: DebtLoanStatus.SETTLED,
      });
      repo.findById.mockResolvedValue(debt);

      const result = await useCase.execute('x', USER, { amount: 150 });

      expect(result.amount).toBe(150);
      // alreadySettled was 100; new amount is 150 → remaining = 50,
      // status reopens to PENDING.
      expect(result.remainingAmount).toBe(50);
      expect(result.status).toBe(DebtLoanStatus.PENDING);
    });

    it('rejects any non-amount field on SETTLED with CANNOT_UPDATE_SETTLED_DEBT_LOAN', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        status: DebtLoanStatus.SETTLED,
        remainingAmount: 0,
      });
      repo.findById.mockResolvedValue(debt);

      await expect(useCase.execute('x', USER, { description: 'nope' })).rejects.toMatchObject({
        code: 'CANNOT_UPDATE_SETTLED_DEBT_LOAN',
      } satisfies Partial<DomainException>);
    });

    it('rejects amount BELOW alreadySettled with DEBT_LOAN_AMOUNT_BELOW_SETTLED', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        amount: 100,
        remainingAmount: 0,
        status: DebtLoanStatus.SETTLED,
      });
      repo.findById.mockResolvedValue(debt);

      await expect(useCase.execute('x', USER, { amount: 50 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_AMOUNT_BELOW_SETTLED',
      } satisfies Partial<DomainException>);
    });
  });

  describe('PENDING rows', () => {
    it('updates description/date/reference/categoryId without touching amount/remaining', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        amount: 200,
        remainingAmount: 80,
        description: 'old',
        reference: 'Juan',
      });
      repo.findById.mockResolvedValue(debt);

      const result = await useCase.execute('x', USER, {
        description: 'updated',
        reference: 'Juan Pérez',
      });

      expect(result.description).toBe('updated');
      expect(result.reference).toBe('Juan Pérez');
      expect(result.amount).toBe(200);
      expect(result.remainingAmount).toBe(80);
    });

    it('rejects reference made only of whitespace', async () => {
      repo.findById.mockResolvedValue(buildDebtLoan({ userId: USER }));
      await expect(useCase.execute('x', USER, { reference: '   ' })).rejects.toMatchObject({
        code: 'DEBT_LOAN_REFERENCE_REQUIRED',
      } satisfies Partial<DomainException>);
    });

    it('trims new reference whitespace', async () => {
      const debt = buildDebtLoan({ userId: USER, reference: 'old' });
      repo.findById.mockResolvedValue(debt);

      const result = await useCase.execute('x', USER, { reference: '  Pedro  ' });
      expect(result.reference).toBe('Pedro');
    });

    it('rejects amount below already-settled on a partially-settled PENDING row', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        amount: 100,
        remainingAmount: 60,
        // alreadySettled = 40
      });
      repo.findById.mockResolvedValue(debt);

      await expect(useCase.execute('x', USER, { amount: 30 })).rejects.toMatchObject({
        code: 'DEBT_LOAN_AMOUNT_BELOW_SETTLED',
      } satisfies Partial<DomainException>);
    });

    it('recomputes remainingAmount when amount goes UP on a PENDING row', async () => {
      const debt = buildDebtLoan({
        userId: USER,
        amount: 100,
        remainingAmount: 60,
        // alreadySettled = 40
      });
      repo.findById.mockResolvedValue(debt);

      const result = await useCase.execute('x', USER, { amount: 150 });
      // alreadySettled stays 40; new remaining = 150 - 40 = 110.
      expect(result.amount).toBe(150);
      expect(result.remainingAmount).toBe(110);
      expect(result.status).toBe(DebtLoanStatus.PENDING);
    });
  });
});
