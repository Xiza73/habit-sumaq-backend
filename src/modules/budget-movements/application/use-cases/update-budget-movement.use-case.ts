import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { BudgetRepository } from '@modules/budgets/domain/budget.repository';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { BudgetMovement } from '../../domain/budget-movement.entity';
import { BudgetMovementRepository } from '../../domain/budget-movement.repository';

import type { UpdateBudgetMovementDto } from '../dto/update-budget-movement.dto';

/**
 * PATCH /budget-movements/:id.
 *
 * Validations:
 *   - Movement exists, belongs to user, not deleted.
 *   - If `amount` or `date` changes, re-validate that the new date
 *     still falls inside the budget's `(year, month)` window.
 *
 * Atomicity:
 *   - If `amount` changes, the difference (`oldAmount - newAmount`) is
 *     applied to the currency pool atomically with the row save.
 *     E.g.: amount goes 100 → 80, pool delta is +20 (refund of 20).
 *           amount goes 100 → 120, pool delta is -20 (extra debit).
 *   - If `amount` does NOT change, no pool movement is needed and we
 *     skip the transaction wrapper (saves a roundtrip).
 *
 * `budgetId`, `currency`, and `userId` are immutable — the DTO doesn't
 * even expose those fields. To "move" a movement, delete + recreate.
 */
@Injectable()
export class UpdateBudgetMovementUseCase {
  constructor(
    private readonly repo: BudgetMovementRepository,
    private readonly budgetRepo: BudgetRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(UpdateBudgetMovementUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string, dto: UpdateBudgetMovementDto): Promise<BudgetMovement> {
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

    // If date changes, re-validate against the budget's month window.
    let newDate: Date | undefined;
    if (dto.date !== undefined) {
      newDate = new Date(dto.date);
      const budget = await this.budgetRepo.findById(movement.budgetId);
      // Defensive: the budget could have been soft-deleted between
      // create and update. In that case the movement is orphaned —
      // we still allow editing description/amount but reject date
      // changes since we can't validate the window.
      if (!budget || budget.isDeleted()) {
        throw new DomainException(
          'BUDGET_NOT_FOUND',
          'Budget no encontrado (no se puede revalidar la fecha)',
        );
      }
      if (!budget.containsDate(newDate)) {
        throw new DomainException(
          'BUDGET_MOVEMENT_DATE_OUT_OF_BUDGET_RANGE',
          `La fecha del movimiento debe caer dentro de ${budget.period}`,
        );
      }
    }

    const oldAmount = movement.amount;
    movement.update({
      amount: dto.amount,
      description: dto.description,
      date: newDate,
      categoryId: dto.categoryId,
    });

    const amountDelta = dto.amount !== undefined ? oldAmount - movement.amount : 0;

    if (amountDelta === 0) {
      // Pure metadata update — no pool movement, skip the tx wrapper.
      const saved = await this.repo.save(movement);
      this.logger.info(
        {
          event: 'budget_movement.updated',
          budgetMovementId: saved.id,
          userId,
          amountChanged: false,
        },
        'budget_movement.updated',
      );
      return saved;
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const persisted = await this.repo.save(movement, manager);
      await this.poolService.applyDelta(userId, movement.currency, amountDelta, manager);
      return persisted;
    });

    this.logger.info(
      {
        event: 'budget_movement.updated',
        budgetMovementId: saved.id,
        userId,
        amountChanged: true,
        oldAmount,
        newAmount: saved.amount,
        poolDelta: amountDelta,
      },
      'budget_movement.updated',
    );

    return saved;
  }
}
