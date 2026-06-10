import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BudgetMovementsModule } from '@modules/budget-movements/presentation/budget-movements.module';
import { CategoriesModule } from '@modules/categories/presentation/categories.module';

import { CreateBudgetUseCase } from '../application/use-cases/create-budget.use-case';
import { DeleteBudgetUseCase } from '../application/use-cases/delete-budget.use-case';
import { GetBudgetUseCase } from '../application/use-cases/get-budget.use-case';
import { GetCurrentBudgetUseCase } from '../application/use-cases/get-current-budget.use-case';
import { ListBudgetsUseCase } from '../application/use-cases/list-budgets.use-case';
import { UpdateBudgetUseCase } from '../application/use-cases/update-budget.use-case';
import { BudgetRepository } from '../domain/budget.repository';
import { BudgetOrmEntity } from '../infrastructure/persistence/budget.orm-entity';
import { BudgetRepositoryImpl } from '../infrastructure/persistence/budget.repository.impl';

import { BudgetsController } from './budgets.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BudgetOrmEntity]),
    // forwardRef breaks the cycle: BudgetMovementsModule imports this module
    // for `BudgetRepository` (to validate budget ownership/currency when
    // creating a movement); this module needs the movements module for the
    // GET use cases that compute `spent` + embedded movements from the
    // v1.0.0 table.
    forwardRef(() => BudgetMovementsModule),
    CategoriesModule,
  ],
  controllers: [BudgetsController],
  providers: [
    { provide: BudgetRepository, useClass: BudgetRepositoryImpl },
    ListBudgetsUseCase,
    GetCurrentBudgetUseCase,
    GetBudgetUseCase,
    CreateBudgetUseCase,
    UpdateBudgetUseCase,
    DeleteBudgetUseCase,
  ],
  exports: [BudgetRepository],
})
export class BudgetsModule {}
