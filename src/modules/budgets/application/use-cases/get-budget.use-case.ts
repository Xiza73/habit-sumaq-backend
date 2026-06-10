import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { BudgetMovementRepository } from '@modules/budget-movements/domain/budget-movement.repository';

import { Budget } from '../../domain/budget.entity';
import { BudgetRepository } from '../../domain/budget.repository';

import { type BudgetKpiSnapshot, computeBudgetKpi } from './compute-budget-kpi';

import type { BudgetMovement } from '@modules/budget-movements/domain/budget-movement.entity';

export interface BudgetDetailResult {
  budget: Budget;
  movements: BudgetMovement[];
  kpi: BudgetKpiSnapshot;
}

/**
 * Fetches a single budget by id, with KPI + movements. Used by the historical
 * view ("ver mi budget de marzo") — KPI for past months returns
 * `daysRemainingIncludingToday: 0` and `dailyAllowance: null`, but the
 * `spent`/`remaining` numbers still reflect what actually happened.
 *
 * v1.0.0 (`accounts-to-modular-finance` refactor): reads from the
 * `budget_movements` table — see `GetCurrentBudgetUseCase` for the
 * rationale.
 */
@Injectable()
export class GetBudgetUseCase {
  constructor(
    private readonly budgetRepo: BudgetRepository,
    private readonly budgetMovementRepo: BudgetMovementRepository,
  ) {}

  async execute(id: string, userId: string, timezone: string): Promise<BudgetDetailResult> {
    const budget = await this.budgetRepo.findById(id);
    if (!budget || budget.userId !== userId || budget.isDeleted()) {
      throw new DomainException('BUDGET_NOT_FOUND', 'Budget no encontrado');
    }

    const [movements, spent] = await Promise.all([
      this.budgetMovementRepo.findByBudgetId(budget.id),
      this.budgetMovementRepo.sumByBudgetId(budget.id),
    ]);
    const kpi = computeBudgetKpi(budget, spent, timezone);

    return { budget, movements, kpi };
  }
}
