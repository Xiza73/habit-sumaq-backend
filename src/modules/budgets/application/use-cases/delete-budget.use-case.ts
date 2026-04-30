import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';
import { TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { BudgetRepository } from '../../domain/budget.repository';

/**
 * Soft-deletes a budget AND nullifies `budgetId` on every linked transaction.
 *
 * Why both ops: the linked transactions represent real money already spent —
 * they MUST survive the budget being deleted. Soft-delete by itself doesn't
 * drop the FK (the soft-deleted row is still in the table), so we explicitly
 * clear `transaction.budgetId` first. The two writes are sequential rather
 * than wrapped in a single DB transaction, mirroring the rest of the codebase
 * (e.g. PayMonthlyServiceUseCase). Worst case (clear succeeds, soft-delete
 * fails): a re-attempt re-clears (idempotent UPDATE) and completes the soft-
 * delete. Inverse failure leaves transactions tagged to a deleted budget,
 * which `findByBudgetId` filters via the soft-delete filter on Budget.
 */
@Injectable()
export class DeleteBudgetUseCase {
  constructor(
    private readonly budgetRepo: BudgetRepository,
    private readonly txRepo: TransactionRepository,
    @InjectPinoLogger(DeleteBudgetUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const budget = await this.budgetRepo.findById(id);
    if (!budget || budget.userId !== userId || budget.isDeleted()) {
      throw new DomainException('BUDGET_NOT_FOUND', 'Budget no encontrado');
    }

    await this.txRepo.clearBudgetIdForBudget(id);
    await this.budgetRepo.softDelete(id);

    this.logger.info({ event: 'budget.deleted', budgetId: id, userId }, 'budget.deleted');
  }
}
