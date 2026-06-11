import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BudgetsModule } from '@modules/budgets/presentation/budgets.module';
import { CurrencyPoolsModule } from '@modules/currency-pools/presentation/currency-pools.module';

import { CreateBudgetMovementUseCase } from '../application/use-cases/create-budget-movement.use-case';
import { DeleteBudgetMovementUseCase } from '../application/use-cases/delete-budget-movement.use-case';
import { GetBudgetMovementUseCase } from '../application/use-cases/get-budget-movement.use-case';
import { ListBudgetMovementsUseCase } from '../application/use-cases/list-budget-movements.use-case';
import { UpdateBudgetMovementUseCase } from '../application/use-cases/update-budget-movement.use-case';
import { BudgetMovementRepository } from '../domain/budget-movement.repository';
import { BudgetMovementOrmEntity } from '../infrastructure/persistence/budget-movement.orm-entity';
import { BudgetMovementRepositoryImpl } from '../infrastructure/persistence/budget-movement.repository.impl';

import { BudgetMovementsController } from './budget-movements.controller';

/**
 * Native `budget_movements` module of the v1.0.0
 * `accounts-to-modular-finance` refactor (Phase A4-B).
 *
 * Imports:
 *   - `BudgetsModule` for `BudgetRepository` (validate ownership,
 *     currency, and date window).
 *   - `CurrencyPoolsModule` for `CurrencyPoolService` (apply pool
 *     deltas atomically with row writes).
 *
 * Does NOT export its own repo — no other module consumes
 * budget_movements yet. Phase A5 wires reports when the time comes.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([BudgetMovementOrmEntity]),
    // forwardRef — see BudgetsModule for the rationale.
    forwardRef(() => BudgetsModule),
    CurrencyPoolsModule,
  ],
  controllers: [BudgetMovementsController],
  providers: [
    { provide: BudgetMovementRepository, useClass: BudgetMovementRepositoryImpl },
    ListBudgetMovementsUseCase,
    GetBudgetMovementUseCase,
    CreateBudgetMovementUseCase,
    UpdateBudgetMovementUseCase,
    DeleteBudgetMovementUseCase,
  ],
  exports: [BudgetMovementRepository],
})
export class BudgetMovementsModule {}
