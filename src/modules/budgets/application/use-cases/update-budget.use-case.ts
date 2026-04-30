import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Budget } from '../../domain/budget.entity';
import { BudgetRepository } from '../../domain/budget.repository';

import type { UpdateBudgetDto } from '../dto/update-budget.dto';

/**
 * Updates the budget's amount. Year, month and currency are immutable —
 * changing them would either orphan or duplicate the linked transactions, so
 * the contract is "delete and re-create". Only the amount is editable.
 */
@Injectable()
export class UpdateBudgetUseCase {
  constructor(private readonly repo: BudgetRepository) {}

  async execute(id: string, userId: string, dto: UpdateBudgetDto): Promise<Budget> {
    const budget = await this.repo.findById(id);
    if (!budget || budget.userId !== userId || budget.isDeleted()) {
      throw new DomainException('BUDGET_NOT_FOUND', 'Budget no encontrado');
    }
    budget.setAmount(dto.amount);
    return this.repo.save(budget);
  }
}
