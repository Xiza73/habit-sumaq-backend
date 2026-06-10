import { Currency } from '@common/enums/currency.enum';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';
import { type BudgetMovementRepository } from '@modules/budget-movements/domain/budget-movement.repository';
import { buildCurrencyPool } from '@modules/currency-pools/domain/__tests__/currency-pool.factory';
import { type CurrencyPoolRepository } from '@modules/currency-pools/domain/currency-pool.repository';
import {
  type DebtLoanRepository,
  type DebtsSummaryRow,
} from '@modules/debts-loans/domain/debt-loan.repository';
import { type MonthlyServicePaymentRepository } from '@modules/monthly-service-payments/domain/monthly-service-payment.repository';
import { buildUserSettings } from '@modules/users/domain/__tests__/user-settings.factory';
import { type UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { GetFinancesDashboardUseCase } from './get-finances-dashboard.use-case';

describe('GetFinancesDashboardUseCase', () => {
  let useCase: GetFinancesDashboardUseCase;
  let accountRepo: jest.Mocked<AccountRepository>;
  let poolRepo: jest.Mocked<CurrencyPoolRepository>;
  let budgetMovementRepo: jest.Mocked<BudgetMovementRepository>;
  let mspRepo: jest.Mocked<MonthlyServicePaymentRepository>;
  let debtLoanRepo: jest.Mocked<DebtLoanRepository>;
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

    budgetMovementRepo = {
      findByBudgetId: jest.fn(),
      findById: jest.fn(),
      sumByBudgetId: jest.fn(),
      sumByCurrencyInRange: jest.fn().mockResolvedValue([]),
      topCategoriesByCurrencyInRange: jest.fn().mockResolvedValue([]),
      dailyByCurrencyInRange: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    mspRepo = {
      findByServiceId: jest.fn(),
      findById: jest.fn(),
      findByServiceAndPeriod: jest.fn(),
      sumByCurrencyInRange: jest.fn().mockResolvedValue([]),
      dailyByCurrencyInRange: jest.fn().mockResolvedValue([]),
      findLastNByServiceId: jest.fn().mockResolvedValue([]),
      sumByServiceIdsInPeriod: jest.fn().mockResolvedValue(new Map()),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    debtLoanRepo = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      aggregateByReference: jest.fn().mockResolvedValue([]),
      findPendingByNormalizedReference: jest.fn(),
    };

    settingsRepo = {
      findByUserId: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
    };

    useCase = new GetFinancesDashboardUseCase(
      accountRepo,
      poolRepo,
      budgetMovementRepo,
      mspRepo,
      debtLoanRepo,
      settingsRepo,
    );
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

  describe('periodFlow (v1.0.0 Path A — pure new-module)', () => {
    it('sums budget_movements + monthly_service_payments per currency; income = 0', async () => {
      budgetMovementRepo.sumByCurrencyInRange.mockResolvedValue([
        { currency: 'PEN', total: 1000 },
        { currency: 'USD', total: 100 },
      ]);
      mspRepo.sumByCurrencyInRange.mockResolvedValue([
        { currency: 'PEN', total: 800 },
        { currency: 'USD', total: 20 },
      ]);

      const result = await useCase.execute('user-1');

      // PEN expense = 1000 + 800 = 1800. USD = 100 + 20 = 120.
      // Income = 0 by design (no general INCOME concept in v1.0.0 yet —
      // LOAN settle deltas arrive in A5-B.3).
      expect(result.periodFlow).toEqual([
        { currency: 'PEN', income: 0, expense: 1800, net: -1800 },
        { currency: 'USD', income: 0, expense: 120, net: -120 },
      ]);
    });

    it('still returns rows even when only one module contributes for that currency', async () => {
      budgetMovementRepo.sumByCurrencyInRange.mockResolvedValue([{ currency: 'PEN', total: 500 }]);
      mspRepo.sumByCurrencyInRange.mockResolvedValue([{ currency: 'USD', total: 75 }]);

      const result = await useCase.execute('user-1');

      expect(result.periodFlow).toEqual([
        { currency: 'PEN', income: 0, expense: 500, net: -500 },
        { currency: 'USD', income: 0, expense: 75, net: -75 },
      ]);
    });

    it('rounds to 2 decimal places to defeat float drift across the merge', async () => {
      budgetMovementRepo.sumByCurrencyInRange.mockResolvedValue([
        { currency: 'PEN', total: 100.336 },
      ]);
      mspRepo.sumByCurrencyInRange.mockResolvedValue([{ currency: 'PEN', total: 50.124 }]);

      const result = await useCase.execute('user-1');

      // 100.336 + 50.124 = 150.46 (rounded to 150.46).
      expect(result.periodFlow[0]).toEqual({
        currency: 'PEN',
        income: 0,
        expense: 150.46,
        net: -150.46,
      });
    });
  });

  it('computes category percentages relative to the currency total (from budget-movements)', async () => {
    budgetMovementRepo.topCategoriesByCurrencyInRange.mockResolvedValue([
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

  describe('dailyFlow (v1.0.0 Path A — pure new-module)', () => {
    it('merges budget_movements + monthly_service_payments per (date, currency); income = 0', async () => {
      // BM contributes 2 dates in PEN, 1 date in USD.
      budgetMovementRepo.dailyByCurrencyInRange.mockResolvedValue([
        { date: '2026-04-19', currency: 'PEN', total: 50 },
        { date: '2026-04-20', currency: 'PEN', total: 30 },
        { date: '2026-04-20', currency: 'USD', total: 10 },
      ]);
      // MSP contributes a same-day overlap (PEN 2026-04-19) and a new date in PEN.
      mspRepo.dailyByCurrencyInRange.mockResolvedValue([
        { date: '2026-04-19', currency: 'PEN', total: 100 },
        { date: '2026-04-21', currency: 'PEN', total: 20 },
      ]);

      const result = await useCase.execute('user-1');

      expect(result.dailyFlow).toEqual([
        {
          currency: 'PEN',
          // Overlap on 2026-04-19: 50 + 100 = 150.
          points: [
            { date: '2026-04-19', income: 0, expense: 150 },
            { date: '2026-04-20', income: 0, expense: 30 },
            { date: '2026-04-21', income: 0, expense: 20 },
          ],
        },
        { currency: 'USD', points: [{ date: '2026-04-20', income: 0, expense: 10 }] },
      ]);
    });

    it('sorts points by date ASC even when source rows arrive unordered', async () => {
      budgetMovementRepo.dailyByCurrencyInRange.mockResolvedValue([
        { date: '2026-04-21', currency: 'PEN', total: 30 },
        { date: '2026-04-19', currency: 'PEN', total: 10 },
      ]);
      mspRepo.dailyByCurrencyInRange.mockResolvedValue([
        { date: '2026-04-20', currency: 'PEN', total: 20 },
      ]);

      const result = await useCase.execute('user-1');

      const dates = result.dailyFlow[0].points.map((p) => p.date);
      expect(dates).toEqual(['2026-04-19', '2026-04-20', '2026-04-21']);
    });
  });

  it('collapses pending-debts rows from debts-loans into a per-currency KPI', async () => {
    const rows: DebtsSummaryRow[] = [
      {
        reference: 'juan',
        currency: Currency.PEN,
        displayName: 'Juan',
        pendingDebt: 100,
        pendingLoan: 200,
        netOwed: 100,
        pendingCount: 2,
        settledCount: 0,
      },
      {
        reference: 'maria',
        currency: Currency.PEN,
        displayName: 'María',
        pendingDebt: 50,
        pendingLoan: 0,
        netOwed: -50,
        pendingCount: 1,
        settledCount: 0,
      },
    ];
    debtLoanRepo.aggregateByReference.mockResolvedValue(rows);

    const result = await useCase.execute('user-1');

    expect(result.pendingDebts).toEqual([{ currency: 'PEN', owesYou: 200, youOwe: 150, net: 50 }]);
    // Verifies we ask for PENDING-only — settled aggregation is out of scope.
    expect(debtLoanRepo.aggregateByReference).toHaveBeenCalledWith('user-1', 'pending');
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

    // Period range gets passed through to the new-module sum methods.
    // We don't assert the exact instant (that's the period helper's
    // job) but we verify userId + Dates are propagated.
    const bmCall = budgetMovementRepo.sumByCurrencyInRange.mock.calls[0];
    expect(bmCall[0]).toBe('user-1');
    expect(bmCall[1]).toBeInstanceOf(Date);
    expect(bmCall[2]).toBeInstanceOf(Date);

    const mspCall = mspRepo.sumByCurrencyInRange.mock.calls[0];
    expect(mspCall[0]).toBe('user-1');
    expect(mspCall[1]).toBeInstanceOf(Date);
    expect(mspCall[2]).toBeInstanceOf(Date);
  });
});
