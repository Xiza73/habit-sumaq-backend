import { Currency } from '@common/enums/currency.enum';

import {
  type DebtLoanRepository,
  type DebtsSummaryRow,
} from '../../../domain/debt-loan.repository';
import { GetDebtsSummaryUseCase } from '../get-debts-summary.use-case';

describe('GetDebtsSummaryUseCase', () => {
  let repo: jest.Mocked<DebtLoanRepository>;
  let useCase: GetDebtsSummaryUseCase;

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
    useCase = new GetDebtsSummaryUseCase(repo);
  });

  it("defaults to status='pending' when no filter is provided", async () => {
    repo.aggregateByReference.mockResolvedValue([]);

    await useCase.execute('user-1');

    expect(repo.aggregateByReference).toHaveBeenCalledWith('user-1', 'pending');
  });

  it('forwards the result rows verbatim', async () => {
    const rows: DebtsSummaryRow[] = [
      {
        reference: 'juan',
        currency: Currency.PEN,
        displayName: 'Juan',
        pendingDebt: 500,
        pendingLoan: 0,
        netOwed: -500,
        pendingCount: 2,
        settledCount: 0,
      },
    ];
    repo.aggregateByReference.mockResolvedValue(rows);

    const result = await useCase.execute('user-1', 'all');

    expect(result).toBe(rows);
    expect(repo.aggregateByReference).toHaveBeenCalledWith('user-1', 'all');
  });
});
