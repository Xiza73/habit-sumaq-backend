import { Injectable } from '@nestjs/common';

import { Budget } from '../../domain/budget.entity';
import { BudgetRepository } from '../../domain/budget.repository';

/**
 * Lists every non-soft-deleted budget owned by the user, newest period first.
 * Used by the history view — KPI is intentionally NOT computed here (cheap
 * list endpoint). Frontend opens the detail view via GET /budgets/:id when
 * the user clicks a row.
 */
@Injectable()
export class ListBudgetsUseCase {
  constructor(private readonly repo: BudgetRepository) {}

  async execute(userId: string): Promise<Budget[]> {
    return this.repo.findByUserId(userId);
  }
}
