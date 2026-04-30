import { DomainException } from '@common/exceptions/domain.exception';
import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { makeBudget } from '../../domain/__tests__/budget.factory';
import { type BudgetRepository } from '../../domain/budget.repository';

import { CreateBudgetUseCase } from './create-budget.use-case';

describe('CreateBudgetUseCase', () => {
  let useCase: CreateBudgetUseCase;
  let repo: jest.Mocked<BudgetRepository>;

  const userId = 'user-1';
  const TZ = 'America/Lima';

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByPeriodAndCurrency: jest.fn(),
      save: jest.fn().mockImplementation((b) => Promise.resolve(b)),
      softDelete: jest.fn(),
    };
    useCase = new CreateBudgetUseCase(repo);
  });

  it('creates a budget with explicit year/month/currency/amount', async () => {
    repo.findByPeriodAndCurrency.mockResolvedValue(null);
    const result = await useCase.execute(
      userId,
      { year: 2026, month: 4, currency: Currency.PEN, amount: 2000 },
      TZ,
    );
    expect(result.year).toBe(2026);
    expect(result.month).toBe(4);
    expect(result.currency).toBe('PEN');
    expect(result.amount).toBe(2000);
    expect(repo.save).toHaveBeenCalled();
  });

  it('defaults year and month to the current period in the client timezone', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T17:00:00.000Z'));
    repo.findByPeriodAndCurrency.mockResolvedValue(null);
    const result = await useCase.execute(userId, { currency: Currency.USD, amount: 500 }, TZ);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(8);
    jest.useRealTimers();
  });

  it('throws BUDGET_ALREADY_EXISTS when a non-deleted budget exists for the tuple', async () => {
    repo.findByPeriodAndCurrency.mockResolvedValue(
      makeBudget({ userId, year: 2026, month: 4, currency: 'PEN' }),
    );
    await expect(
      useCase.execute(userId, { year: 2026, month: 4, currency: Currency.PEN, amount: 2000 }, TZ),
    ).rejects.toThrow(DomainException);
    await expect(
      useCase.execute(userId, { year: 2026, month: 4, currency: Currency.PEN, amount: 2000 }, TZ),
    ).rejects.toMatchObject({ code: 'BUDGET_ALREADY_EXISTS' });
    expect(repo.save).not.toHaveBeenCalled();
  });
});
