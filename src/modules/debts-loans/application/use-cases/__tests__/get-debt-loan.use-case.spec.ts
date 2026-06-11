import { type DomainException } from '@common/exceptions/domain.exception';

import { buildDebtLoan } from '../../../domain/__tests__/debt-loan.factory';
import { type DebtLoanRepository } from '../../../domain/debt-loan.repository';
import { GetDebtLoanUseCase } from '../get-debt-loan.use-case';

describe('GetDebtLoanUseCase', () => {
  let repo: jest.Mocked<DebtLoanRepository>;
  let useCase: GetDebtLoanUseCase;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      aggregateByReference: jest.fn(),
      findPendingByNormalizedReference: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new GetDebtLoanUseCase(repo);
  });

  it('returns the debt when found and owned by the user', async () => {
    const debt = buildDebtLoan({ userId: 'user-1' });
    repo.findById.mockResolvedValue(debt);

    const result = await useCase.execute(debt.id, 'user-1');

    expect(result).toBe(debt);
  });

  it('throws DEBT_LOAN_NOT_FOUND when the id does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id', 'user-1')).rejects.toMatchObject({
      code: 'DEBT_LOAN_NOT_FOUND',
    } satisfies Partial<DomainException>);
  });

  it('throws DEBT_LOAN_NOT_FOUND when the row is soft-deleted', async () => {
    const deleted = buildDebtLoan({ deletedAt: new Date(), userId: 'user-1' });
    repo.findById.mockResolvedValue(deleted);

    await expect(useCase.execute(deleted.id, 'user-1')).rejects.toMatchObject({
      code: 'DEBT_LOAN_NOT_FOUND',
    } satisfies Partial<DomainException>);
  });

  it('throws DEBT_LOAN_BELONGS_TO_OTHER_USER on cross-user access', async () => {
    repo.findById.mockResolvedValue(buildDebtLoan({ userId: 'someone-else' }));

    await expect(useCase.execute('any', 'user-1')).rejects.toMatchObject({
      code: 'DEBT_LOAN_BELONGS_TO_OTHER_USER',
    } satisfies Partial<DomainException>);
  });
});
