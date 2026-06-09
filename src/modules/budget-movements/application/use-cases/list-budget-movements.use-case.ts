import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { BudgetRepository } from '@modules/budgets/domain/budget.repository';

import { BudgetMovementRepository } from '../../domain/budget-movement.repository';

import type { BudgetMovement } from '../../domain/budget-movement.entity';

@Injectable()
export class ListBudgetMovementsUseCase {
  constructor(
    private readonly repo: BudgetMovementRepository,
    private readonly budgetRepo: BudgetRepository,
  ) {}

  async execute(userId: string, budgetId: string): Promise<BudgetMovement[]> {
    // Validate the budget exists and belongs to the user BEFORE listing
    // its movements — otherwise an attacker with a known budgetId could
    // probe whether it exists by status code.
    const budget = await this.budgetRepo.findById(budgetId);
    if (!budget || budget.isDeleted()) {
      throw new DomainException('BUDGET_NOT_FOUND', 'Budget no encontrado');
    }
    if (budget.userId !== userId) {
      throw new DomainException(
        'BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER',
        'No tenés acceso a este budget',
      );
    }
    return this.repo.findByBudgetId(budgetId);
  }
}
