import { Injectable } from '@nestjs/common';

import { AccountRepository } from '@modules/accounts/domain/account.repository';
import { TransactionRepository } from '@modules/transactions/domain/transaction.repository';
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
    private readonly accountRepo: AccountRepository,
    private readonly txRepo: TransactionRepository,
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

    const [accounts, flow, topCategories, dailyFlow, debts] = await Promise.all([
      this.accountRepo.findByUserId(userId, false),
      this.txRepo.sumFlowByCurrencyInRange(userId, range.from, range.to),
      this.txRepo.topExpenseCategoriesInRange(userId, range.from, range.to, TOP_CATEGORIES_LIMIT),
      this.txRepo.dailyNetFlowInRange(userId, range.from, range.to),
      this.txRepo.aggregateDebtsByReference(userId, 'pending'),
    ]);

    // Widget 1: totalBalance — sum active-account balances per currency.
    const balanceByCurrency = new Map<string, { amount: number; count: number }>();
    for (const account of accounts) {
      const current = balanceByCurrency.get(account.currency) ?? { amount: 0, count: 0 };
      current.amount += account.balance;
      current.count += 1;
      balanceByCurrency.set(account.currency, current);
    }
    const totalBalance = Array.from(balanceByCurrency.entries())
      .map(([currency, { amount, count }]) => ({
        currency,
        amount: round(amount),
        accountCount: count,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

    // Widget 2: periodFlow — income + expense per currency in range.
    const periodFlow = flow.map((f) => ({
      currency: f.currency,
      income: round(f.income),
      expense: round(f.expense),
      net: round(f.income - f.expense),
    }));

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

    // Widget 4: dailyFlow — group per-currency, each with ordered points.
    const dailyByCurrency = new Map<string, { date: string; income: number; expense: number }[]>();
    for (const row of dailyFlow) {
      const series = dailyByCurrency.get(row.currency) ?? [];
      series.push({ date: row.date, income: round(row.income), expense: round(row.expense) });
      dailyByCurrency.set(row.currency, series);
    }
    const dailyFlowSeries = Array.from(dailyByCurrency.entries())
      .map(([currency, points]) => ({ currency, points }))
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
