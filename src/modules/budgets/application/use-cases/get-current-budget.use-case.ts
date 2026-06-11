import { Injectable } from '@nestjs/common';

import { BudgetMovementRepository } from '@modules/budget-movements/domain/budget-movement.repository';

import { Budget } from '../../domain/budget.entity';
import { BudgetRepository } from '../../domain/budget.repository';
import { currentMonthInTimezone } from '../../infrastructure/timezone/current-month-in-timezone';

import { type BudgetKpiSnapshot, computeBudgetKpi } from './compute-budget-kpi';

import type { BudgetMovement } from '@modules/budget-movements/domain/budget-movement.entity';

export interface CurrentBudgetResult {
  budget: Budget;
  movements: BudgetMovement[];
  kpi: BudgetKpiSnapshot;
}

/**
 * Returns the current month's budget for a given currency, with KPI snapshot
 * and embedded movements. Returns `null` when no budget exists — the
 * frontend renders "create budget" CTA in that case.
 *
 * v1.0.0 (`accounts-to-modular-finance` refactor):
 *   - Movements and the `spent` aggregate now come from the
 *     `budget_movements` table (the new dedicated module), NOT from
 *     legacy `transactions` tagged with `budgetId`. The latter is
 *     scheduled for deletion in A6-B; reading from it here would
 *     silently return stale data the moment a user creates a movement
 *     through the v1.0.0 `POST /budget-movements` endpoint.
 */
@Injectable()
export class GetCurrentBudgetUseCase {
  constructor(
    private readonly budgetRepo: BudgetRepository,
    private readonly budgetMovementRepo: BudgetMovementRepository,
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
      this.budgetMovementRepo.findByBudgetId(budget.id),
      this.budgetMovementRepo.sumByBudgetId(budget.id),
    ]);
    const kpi = computeBudgetKpi(budget, spent, timezone);

    return { budget, movements, kpi };
  }
}
