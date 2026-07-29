import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { type DomainException } from '@common/exceptions/domain.exception';

import { buildDebtLoan } from '../../../domain/__tests__/debt-loan.factory';
import { type DebtLoanRepository } from '../../../domain/debt-loan.repository';
import { DeleteDebtLoanUseCase } from '../delete-debt-loan.use-case';

describe('DeleteDebtLoanUseCase', () => {
  let repo: jest.Mocked<DebtLoanRepository>;
  let useCase: DeleteDebtLoanUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      aggregateByReference: jest.fn(),
      findPendingByNormalizedReference: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      findBySourcePaymentIds: jest.fn().mockResolvedValue([]),
    };
    logger = buildMockPinoLogger();
    useCase = new DeleteDebtLoanUseCase(repo, logger as unknown as PinoLogger);
  });

  it('soft-deletes when the row exists and belongs to the user', async () => {
    const debt = buildDebtLoan({ userId: 'user-1' });
    repo.findById.mockResolvedValue(debt);

    await useCase.execute(debt.id, 'user-1');

    expect(repo.softDelete).toHaveBeenCalledWith(debt.id);
  });

  it('throws DEBT_LOAN_NOT_FOUND if the row does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', 'user-1')).rejects.toMatchObject({
      code: 'DEBT_LOAN_NOT_FOUND',
    } satisfies Partial<DomainException>);
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('throws DEBT_LOAN_NOT_FOUND when the row is already soft-deleted', async () => {
    repo.findById.mockResolvedValue(buildDebtLoan({ userId: 'user-1', deletedAt: new Date() }));

    await expect(useCase.execute('x', 'user-1')).rejects.toMatchObject({
      code: 'DEBT_LOAN_NOT_FOUND',
    } satisfies Partial<DomainException>);
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('rejects cross-user deletes with DEBT_LOAN_BELONGS_TO_OTHER_USER', async () => {
    repo.findById.mockResolvedValue(buildDebtLoan({ userId: 'other' }));

    await expect(useCase.execute('x', 'user-1')).rejects.toMatchObject({
      code: 'DEBT_LOAN_BELONGS_TO_OTHER_USER',
    } satisfies Partial<DomainException>);
  });

  it('logs the deletion event with unrevertedSettlement amount', async () => {
    const debt = buildDebtLoan({ userId: 'user-1', amount: 100, remainingAmount: 30 });
    repo.findById.mockResolvedValue(debt);

    await useCase.execute(debt.id, 'user-1');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'debt_loan.deleted',
        unrevertedSettlement: 70,
      }),
      'debt_loan.deleted',
    );
  });
});
