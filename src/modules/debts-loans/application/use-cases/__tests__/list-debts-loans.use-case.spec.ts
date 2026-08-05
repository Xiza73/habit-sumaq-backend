import { buildDebtLoan } from '../../../domain/__tests__/debt-loan.factory';
import { type DebtLoanRepository } from '../../../domain/debt-loan.repository';
import { ListDebtsLoansUseCase } from '../list-debts-loans.use-case';

describe('ListDebtsLoansUseCase', () => {
  let repo: jest.Mocked<DebtLoanRepository>;
  let useCase: ListDebtsLoansUseCase;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      aggregateByReference: jest.fn(),
      findPendingByNormalizedReference: jest.fn(),
      findPendingByReferenceCurrencyType: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      findBySourcePaymentIds: jest.fn().mockResolvedValue([]),
    };
    useCase = new ListDebtsLoansUseCase(repo);
  });

  it("defaults to status='pending' when no filter is provided", async () => {
    repo.findByUserId.mockResolvedValue([]);

    await useCase.execute('user-1');

    expect(repo.findByUserId).toHaveBeenCalledWith('user-1', 'pending');
  });

  it("forwards the status filter to the repo when 'all' is requested", async () => {
    const rows = [buildDebtLoan(), buildDebtLoan()];
    repo.findByUserId.mockResolvedValue(rows);

    const result = await useCase.execute('user-1', 'all');

    expect(repo.findByUserId).toHaveBeenCalledWith('user-1', 'all');
    expect(result).toBe(rows);
  });

  it("forwards the 'settled' filter unchanged", async () => {
    repo.findByUserId.mockResolvedValue([]);
    await useCase.execute('user-1', 'settled');
    expect(repo.findByUserId).toHaveBeenCalledWith('user-1', 'settled');
  });
});
