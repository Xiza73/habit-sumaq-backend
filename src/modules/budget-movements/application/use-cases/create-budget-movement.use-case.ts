import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { BudgetRepository } from '@modules/budgets/domain/budget.repository';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { BudgetMovement } from '../../domain/budget-movement.entity';
import { BudgetMovementRepository } from '../../domain/budget-movement.repository';

import type { CreateBudgetMovementDto } from '../dto/create-budget-movement.dto';

/**
 * POST /budget-movements.
 *
 * Validations:
 *   - Budget exists, belongs to the user, not deleted.
 *   - `date` (defaulted to now) falls inside the budget's
 *     `(year, month)`.
 *   - The movement's currency is the budget's currency (read from the
 *     budget — not passed in the DTO).
 *
 * Atomicity:
 *   - Single `dataSource.transaction()` wraps `repo.save(movement)` and
 *     `pool.applyDelta(userId, currency, -amount)`. If either step
 *     fails, neither persists.
 */
@Injectable()
export class CreateBudgetMovementUseCase {
  constructor(
    private readonly repo: BudgetMovementRepository,
    private readonly budgetRepo: BudgetRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(CreateBudgetMovementUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(userId: string, dto: CreateBudgetMovementDto): Promise<BudgetMovement> {
    const budget = await this.budgetRepo.findById(dto.budgetId);
    if (!budget || budget.isDeleted()) {
      throw new DomainException('BUDGET_NOT_FOUND', 'Budget no encontrado');
    }
    if (budget.userId !== userId) {
      throw new DomainException(
        'BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER',
        'No tenés acceso a este budget',
      );
    }

    const date = dto.date ? new Date(dto.date) : new Date();
    if (!budget.containsDate(date)) {
      throw new DomainException(
        'BUDGET_MOVEMENT_DATE_OUT_OF_BUDGET_RANGE',
        `La fecha del movimiento debe caer dentro de ${budget.period}`,
      );
    }

    const now = new Date();
    const movement = new BudgetMovement(
      randomUUID(),
      userId,
      budget.id,
      dto.categoryId ?? null,
      // The new module doesn't take currency from the client — it's
      // inferred from the budget, which is the single source of truth.
      budget.currency as BudgetMovement['currency'],
      dto.amount,
      dto.description ?? null,
      date,
      now,
      now,
      null,
    );

    const saved = await this.dataSource.transaction(async (manager) => {
      const persisted = await this.repo.save(movement, manager);
      await this.poolService.applyDelta(
        userId,
        budget.currency as BudgetMovement['currency'],
        -dto.amount,
        manager,
      );
      return persisted;
    });

    this.logger.info(
      {
        event: 'budget_movement.created',
        budgetMovementId: saved.id,
        userId,
        budgetId: budget.id,
        currency: budget.currency,
        amount: dto.amount,
        poolDelta: -dto.amount,
      },
      'budget_movement.created',
    );

    return saved;
  }
}
