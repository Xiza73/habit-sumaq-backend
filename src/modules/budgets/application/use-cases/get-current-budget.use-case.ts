import { Injectable } from '@nestjs/common';

import { TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { Budget } from '../../domain/budget.entity';
import { BudgetRepository } from '../../domain/budget.repository';
import { currentMonthInTimezone } from '../../infrastructure/timezone/current-month-in-timezone';

import { type BudgetKpiSnapshot, computeBudgetKpi } from './compute-budget-kpi';

import type { Transaction } from '@modules/transactions/domain/transaction.entity';

export interface CurrentBudgetResult {
  budget: Budget;
  movements: Transaction[];
  kpi: BudgetKpiSnapshot;
}

/**
 * Returns the current month's budget for a given currency, with KPI snapshot
 * and embedded movements. Returns `null` when no budget exists — the
 * frontend renders "create budget" CTA in that case.
 */
@Injectable()
export class GetCurrentBudgetUseCase {
  constructor(
    private readonly budgetRepo: BudgetRepository,
    private readonly txRepo: TransactionRepository,
  ) {}

  async execute(
    userId: string,
    currency: string,
    timezone: string,
  ): Promise<CurrentBudgetResult | null> {
    const { year, month } = currentMonthInTimezone(timezone);
    const budget = await this.budgetRepo.findByPeriodAndCurrency(userId, year, month, currency);
    if (!budget) return null;

    const [movements, spent] = await Promise.all([
      this.txRepo.findByBudgetId(budget.id),
      this.txRepo.sumAmountByBudgetId(budget.id),
    ]);
    const kpi = computeBudgetKpi(budget, spent, timezone);

    return { budget, movements, kpi };
  }
}
