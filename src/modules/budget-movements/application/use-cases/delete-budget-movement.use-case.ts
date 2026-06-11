import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { BudgetMovementRepository } from '../../domain/budget-movement.repository';

/**
 * DELETE /budget-movements/:id.
 *
 * Soft-delete + refund the pool. Atomic via `dataSource.transaction()`:
 *   1. softDelete the row
 *   2. applyDelta(+amount) to refund the pool — the money "comes back"
 *      to the user's currency pool as if the expense never happened.
 *
 * Unlike `debts_loans` where delete intentionally does NOT revert prior
 * settlements (per design — the debt's history of real-payments is a
 * record of money that actually moved, even if the obligation is later
 * removed), a budget movement IS the recorded expense itself. Deleting
 * it should reverse the pool impact.
 */
@Injectable()
export class DeleteBudgetMovementUseCase {
  constructor(
    private readonly repo: BudgetMovementRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(DeleteBudgetMovementUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
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

    await this.dataSource.transaction(async (manager) => {
      await this.repo.softDelete(id, manager);
      await this.poolService.applyDelta(userId, movement.currency, movement.amount, manager);
    });

    this.logger.info(
      {
        event: 'budget_movement.deleted',
        budgetMovementId: id,
        userId,
        budgetId: movement.budgetId,
        currency: movement.currency,
        refundAmount: movement.amount,
      },
      'budget_movement.deleted',
    );
  }
}
