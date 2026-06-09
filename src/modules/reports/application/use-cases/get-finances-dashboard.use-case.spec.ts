import { Currency } from '@common/enums/currency.enum';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';
import { buildCurrencyPool } from '@modules/currency-pools/domain/__tests__/currency-pool.factory';
import { type CurrencyPoolRepository } from '@modules/currency-pools/domain/currency-pool.repository';
import {
  type DebtsSummaryRow,
  type TransactionRepository,
} from '@modules/transactions/domain/transaction.repository';
import { buildUserSettings } from '@modules/users/domain/__tests__/user-settings.factory';
import { type UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { GetFinancesDashboardUseCase } from './get-finances-dashboard.use-case';

describe('GetFinancesDashboardUseCase', () => {
  let useCase: GetFinancesDashboardUseCase;
  let accountRepo: jest.Mocked<AccountRepository>;
  let poolRepo: jest.Mocked<CurrencyPoolRepository>;
  let txRepo: jest.Mocked<TransactionRepository>;
  let settingsRepo: jest.Mocked<UserSettingsRepository>;

  beforeEach(() => {
    accountRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    poolRepo = {
      findByUserIdAndCurrency: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
    };

    txRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByRelatedTransactionId: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      existsByAccountId: jest.fn(),
      aggregateDebtsByReference: jest.fn().mockResolvedValue([]),
      findPendingDebtOrLoanByNormalizedReference: jest.fn(),
      sumFlowByCurrencyInRange: jest.fn().mockResolvedValue([]),
      topExpenseCategoriesInRange: jest.fn().mockResolvedValue([]),
      dailyNetFlowInRange: jest.fn().mockResolvedValue([]),
      countByMonthlyServiceId: jest.fn(),
      findLastNByMonthlyServiceId: jest.fn(),
      sumAmountByMonthlyServiceIdsInPeriod: jest.fn().mockResolvedValue(new Map()),
      findByBudgetId: jest.fn(),
      sumAmountByBudgetId: jest.fn(),
      clearBudgetIdForBudget: jest.fn(),
    };

    settingsRepo = {
      findByUserId: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
    };

    useCase = new GetFinancesDashboardUseCase(accountRepo, poolRepo, txRepo, settingsRepo);
  });

  it('returns an empty-ish payload for a user with no activity', async () => {
    const result = await useCase.execute('user-1');

    expect(result.period).toBe('month');
    expect(result.totalBalance).toEqual([]);
    expect(result.periodFlow).toEqual([]);
    expect(result.topExpenseCategories).toEqual([]);
    expect(result.dailyFlow).toEqual([]);
    expect(result.pendingDebts).toEqual([]);
    // Range is always populated with ISO strings so the UI can render it.
    expect(result.range.from).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.range.to).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('reads totalBalance.amount from currency_pools and accountCount from accounts (rounds to 2 decimals)', async () => {
    // Pool is the authoritative balance source from v1.0.0 (Phase A5-B.1).
    poolRepo.findByUserId.mockResolvedValue([
      buildCurrencyPool({ currency: Currency.PEN, balance: 150.33 }),
      buildCurrencyPool({ currency: Currency.USD, balance: 75 }),
    ]);
    // Accounts still produces the legacy `accountCount` field for response
    // compatibility — drops away in A6 when accounts module is retired.
    accountRepo.findByUserId.mockResolvedValue([
      buildAccount({ currency: Currency.PEN }),
      buildAccount({ currency: Currency.PEN }),
      buildAccount({ currency: Currency.USD }),
    ]);

    const result = await useCase.execute('user-1');

    expect(result.totalBalance).toEqual([
      { currency: 'PEN', amount: 150.33, accountCount: 2 },
      { currency: 'USD', amount: 75, accountCount: 1 },
    ]);
  });

  it('treats accountCount as 0 when the user has a pool but no active accounts (post-A6 surface)', async () => {
    poolRepo.findByUserId.mockResolvedValue([
      buildCurrencyPool({ currency: Currency.EUR, balance: 250 }),
    ]);
    accountRepo.findByUserId.mockResolvedValue([]);

    const result = await useCase.execute('user-1');

    expect(result.totalBalance).toEqual([{ currency: 'EUR', amount: 250, accountCount: 0 }]);
  });

  it('maps income/expense rows into periodFlow with net', async () => {
    txRepo.sumFlowByCurrencyInRange.mockResolvedValue([
      { currency: 'PEN', income: 3000, expense: 1800 },
      { currency: 'USD', income: 100, expense: 120 },
    ]);

    const result = await useCase.execute('user-1');

    expect(result.periodFlow).toEqual([
      { currency: 'PEN', income: 3000, expense: 1800, net: 1200 },
      { currency: 'USD', income: 100, expense: 120, net: -20 },
    ]);
  });

  it('computes category percentages relative to the currency total', async () => {
    txRepo.topExpenseCategoriesInRange.mockResolvedValue([
      { categoryId: 'c1', name: 'Comida', color: '#f00', currency: 'PEN', total: 600 },
      { categoryId: 'c2', name: 'Transporte', color: '#00f', currency: 'PEN', total: 200 },
      { categoryId: 'c3', name: 'Dining', color: '#0f0', currency: 'USD', total: 100 },
    ]);

    const result = await useCase.execute('user-1');

    // PEN total = 800 → Comida 75%, Transporte 25%. USD total = 100 → 100%.
    expect(result.topExpenseCategories).toEqual([
      expect.objectContaining({ name: 'Comida', currency: 'PEN', percentage: 75 }),
      expect.objectContaining({ name: 'Transporte', currency: 'PEN', percentage: 25 }),
      expect.objectContaining({ name: 'Dining', currency: 'USD', percentage: 100 }),
    ]);
  });

  it('groups daily flow rows into a series per currency', async () => {
    txRepo.dailyNetFlowInRange.mockResolvedValue([
      { date: '2026-04-19', currency: 'PEN', income: 100, expense: 50 },
      { date: '2026-04-20', currency: 'PEN', income: 0, expense: 30 },
      { date: '2026-04-20', currency: 'USD', income: 20, expense: 0 },
    ]);

    const result = await useCase.execute('user-1');

    expect(result.dailyFlow).toEqual([
      {
        currency: 'PEN',
        points: [
          { date: '2026-04-19', income: 100, expense: 50 },
          { date: '2026-04-20', income: 0, expense: 30 },
        ],
      },
      { currency: 'USD', points: [{ date: '2026-04-20', income: 20, expense: 0 }] },
    ]);
  });

  it('collapses pending-debts rows into a per-currency KPI', async () => {
    const rows: DebtsSummaryRow[] = [
      {
        reference: 'juan',
        currency: 'PEN',
        displayName: 'Juan',
        pendingDebt: 100,
        pendingLoan: 200,
        netOwed: 100,
        pendingCount: 2,
        settledCount: 0,
      },
      {
        reference: 'maria',
        currency: 'PEN',
        displayName: 'María',
        pendingDebt: 50,
        pendingLoan: 0,
        netOwed: -50,
        pendingCount: 1,
        settledCount: 0,
      },
    ];
    txRepo.aggregateDebtsByReference.mockResolvedValue(rows);

    const result = await useCase.execute('user-1');

    expect(result.pendingDebts).toEqual([{ currency: 'PEN', owesYou: 200, youOwe: 150, net: 50 }]);
  });

  it('honors a non-default period', async () => {
    const result = await useCase.execute('user-1', 'week');
    expect(result.period).toBe('week');
  });

  it('uses the user timezone from settings when computing the range', async () => {
    settingsRepo.findByUserId.mockResolvedValue(
      buildUserSettings({ userId: 'user-1', timezone: 'America/Lima' }),
    );
    await useCase.execute('user-1', 'month');

    // The first argument to sumFlowByCurrencyInRange is userId, and the
    // second is the `from` Date. We don't assert the exact instant (that's
    // the period helper's job) but we make sure a Date was passed through.
    const call = txRepo.sumFlowByCurrencyInRange.mock.calls[0];
    expect(call[0]).toBe('user-1');
    expect(call[1]).toBeInstanceOf(Date);
    expect(call[2]).toBeInstanceOf(Date);
  });
});
