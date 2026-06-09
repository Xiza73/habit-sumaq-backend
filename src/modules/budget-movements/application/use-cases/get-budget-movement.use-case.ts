import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { BudgetMovementRepository } from '../../domain/budget-movement.repository';

import type { BudgetMovement } from '../../domain/budget-movement.entity';

@Injectable()
export class GetBudgetMovementUseCase {
  constructor(private readonly repo: BudgetMovementRepository) {}

  async execute(id: string, userId: string): Promise<BudgetMovement> {
    const movement = await this.repo.findById(id);
    if (!movement || movement.isDeleted()) {
      throw new DomainException('BUDGET_MOVEMENT_NOT_FOUND', 'Movimiento no encontrado');
    }
    if (movement.userId !== userId) {
      throw new DomainException(
        'BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER',
        'No tenés acceso a este movimiento',
      );
    }
    return movement;
  }
}
