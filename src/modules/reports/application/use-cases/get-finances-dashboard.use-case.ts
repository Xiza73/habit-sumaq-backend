import { Injectable } from '@nestjs/common';

import { BudgetMovementRepository } from '@modules/budget-movements/domain/budget-movement.repository';
import { CurrencyPoolRepository } from '@modules/currency-pools/domain/currency-pool.repository';
import { DebtLoanRepository } from '@modules/debts-loans/domain/debt-loan.repository';
import { MonthlyServicePaymentRepository } from '@modules/monthly-service-payments/domain/monthly-service-payment.repository';
import { StartOfWeek } from '@modules/users/domain/enums/start-of-week.enum';
import { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { type FinancesDashboardResponseDto } from '../dto/finances-dashboard-response.dto';
import { computePeriodRange, type Period } from '../utils/period-range';

const TOP_CATEGORIES_LIMIT = 5;
const DEFAULT_PERIOD: Period = 'month';
const DEFAULT_TIMEZONE = 'UTC';

@Injectable()
export class GetFinancesDashboardUseCase {
  constructor(
    private readonly poolRepo: CurrencyPoolRepository,
    private readonly budgetMovementRepo: BudgetMovementRepository,
    private readonly mspRepo: MonthlyServicePaymentRepository,
    private readonly debtLoanRepo: DebtLoanRepository,
    private readonly settingsRepo: UserSettingsRepository,
  ) {}

  async execute(
    userId: string,
    period: Period = DEFAULT_PERIOD,
  ): Promise<FinancesDashboardResponseDto> {
    const settings = await this.settingsRepo.findByUserId(userId);
    const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;
    const startOfWeek = settings?.startOfWeek ?? StartOfWeek.MONDAY;

    const range = computePeriodRange(period, timezone, startOfWeek);

    const [
      pools,
      budgetMovementSums,
      mspSums,
      topCategories,
      budgetMovementDaily,
      mspDaily,
      debts,
    ] = await Promise.all([
      this.poolRepo.findByUserId(userId),
      this.budgetMovementRepo.sumByCurrencyInRange(userId, range.from, range.to),
      this.mspRepo.sumByCurrencyInRange(userId, range.from, range.to),
      this.budgetMovementRepo.topCategoriesByCurrencyInRange(
        userId,
        range.from,
        range.to,
        TOP_CATEGORIES_LIMIT,
      ),
      this.budgetMovementRepo.dailyByCurrencyInRange(userId, range.from, range.to),
      this.mspRepo.dailyByCurrencyInRange(userId, range.from, range.to),
      this.debtLoanRepo.aggregateByReference(userId, 'pending'),
    ]);

    // Widget 1: totalBalance — pool balances per currency.
    //
    // v1.0.0 (Phase A6-B): the legacy `accountCount` field is gone. The
    // accounts module was dropped — there's no per-currency account count
    // anymore. The web already stopped reading it in A6-W.5.
    const totalBalance = pools
      .map((pool) => ({
        currency: pool.currency,
        amount: round(pool.balance),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

    // Widget 2: periodFlow — income + expense per currency in range.
    //
    // v1.0.0 semantics (Phase A5-B.2 — Path A, pure new-module):
    //   - **expense** = SUM(budget_movements) + SUM(monthly_service_payments)
    //     in range, grouped by currency. The new model has NO loose
    //     expense — every expense is tagged with a budget or a service.
    //   - **income** = 0 for now. There is no general INCOME concept in
    //     the new model. The only "money in" source is LOAN settle
    //     real-payments, which arrives in A5-B.3 (the debt-loan repo
    //     doesn't yet expose settle-event aggregation by time range).
    //
    // The widget's response shape stays the same so the web doesn't
    // need to change. Numbers WILL differ from the legacy dashboard —
    // by design.
    const expenseByCurrency = new Map<string, number>();
    for (const bm of budgetMovementSums) {
      expenseByCurrency.set(bm.currency, (expenseByCurrency.get(bm.currency) ?? 0) + bm.total);
    }
    for (const msp of mspSums) {
      expenseByCurrency.set(msp.currency, (expenseByCurrency.get(msp.currency) ?? 0) + msp.total);
    }
    const periodFlow = Array.from(expenseByCurrency.entries())
      .map(([currency, expense]) => ({
        currency,
        income: 0,
        expense: round(expense),
        net: round(-expense),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

    // Widget 3: topExpenseCategories — add percentage (of total EXPENSE for the
    // same currency). Uncategorized rows surface with name=null for the UI.
    const totalExpenseByCurrency = new Map<string, number>();
    for (const row of topCategories) {
      totalExpenseByCurrency.set(
        row.currency,
        (totalExpenseByCurrency.get(row.currency) ?? 0) + row.total,
      );
    }
    const topExpenseCategories = topCategories.map((row) => {
      const total = totalExpenseByCurrency.get(row.currency) ?? 0;
      return {
        categoryId: row.categoryId,
        name: row.name,
        color: row.color,
        currency: row.currency,
        total: round(row.total),
        percentage: total > 0 ? round((row.total / total) * 100) : 0,
      };
    });

    // Widget 4: dailyFlow — per-currency timeline with one point per
    // calendar day in range. Combines `budget_movements` and
    // `monthly_service_payments` by `(date, currency)`. Same v1.0.0
    // semantics as periodFlow: income = 0 by design (no general INCOME
    // concept), expense = sum of both new modules.
    //
    // Day rows from each module are merged in a Map<currency, Map<date, expense>>.
    const dailyExpenseByCurrency = new Map<string, Map<string, number>>();
    const accumulateDaily = (rows: Array<{ date: string; currency: string; total: number }>) => {
      for (const row of rows) {
        const perCurrency = dailyExpenseByCurrency.get(row.currency) ?? new Map<string, number>();
        perCurrency.set(row.date, (perCurrency.get(row.date) ?? 0) + row.total);
        dailyExpenseByCurrency.set(row.currency, perCurrency);
      }
    };
    accumulateDaily(budgetMovementDaily);
    accumulateDaily(mspDaily);

    const dailyFlowSeries = Array.from(dailyExpenseByCurrency.entries())
      .map(([currency, perDay]) => ({
        currency,
        // Sort the points by date ASC — the merged map may have come
        // from two unordered sources.
        points: Array.from(perDay.entries())
          .map(([date, expense]) => ({ date, income: 0, expense: round(expense) }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

    // Widget 5: pendingDebts — collapse DebtsSummaryRow into a per-currency KPI.
    const debtsByCurrency = new Map<string, { owesYou: number; youOwe: number }>();
    for (const row of debts) {
      const current = debtsByCurrency.get(row.currency) ?? { owesYou: 0, youOwe: 0 };
      current.owesYou += row.pendingLoan;
      current.youOwe += row.pendingDebt;
      debtsByCurrency.set(row.currency, current);
    }
    const pendingDebts = Array.from(debtsByCurrency.entries())
      .map(([currency, { owesYou, youOwe }]) => ({
        currency,
        owesYou: round(owesYou),
        youOwe: round(youOwe),
        net: round(owesYou - youOwe),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

    return {
      period,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totalBalance,
      periodFlow,
      topExpenseCategories,
      dailyFlow: dailyFlowSeries,
      pendingDebts,
    };
  }
}

/** Round to 2 decimal places to keep money math sane across JS floats. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
