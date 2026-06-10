import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';

import { BudgetRepository } from '../../domain/budget.repository';

/**
 * Soft-deletes a budget.
 *
 * v1.0.0 (Phase A6-B): the legacy "nullify `budgetId` on linked transactions"
 * step is gone — the transactions module no longer exists. v1.0.0 movements
 * live in `budget_movements` which carries `budgetId` as a soft FK; orphaned
 * rows after a budget soft-delete are still readable but no surface joins
 * them. A future garbage-collection migration may detach them; for now we
 * accept them as historic.
 */
@Injectable()
export class DeleteBudgetUseCase {
  constructor(
    private readonly budgetRepo: BudgetRepository,
    @InjectPinoLogger(DeleteBudgetUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const budget = await this.budgetRepo.findById(id);
    if (!budget || budget.userId !== userId || budget.isDeleted()) {
      throw new DomainException('BUDGET_NOT_FOUND', 'Budget no encontrado');
    }

    await this.budgetRepo.softDelete(id);

    this.logger.info({ event: 'budget.deleted', budgetId: id, userId }, 'budget.deleted');
  }
}
