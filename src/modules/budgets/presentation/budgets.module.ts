import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountsModule } from '@modules/accounts/presentation/accounts.module';
import { CategoriesModule } from '@modules/categories/presentation/categories.module';
import { TransactionsModule } from '@modules/transactions/presentation/transactions.module';

import { AddBudgetMovementUseCase } from '../application/use-cases/add-budget-movement.use-case';
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
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
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
    AddBudgetMovementUseCase,
  ],
  exports: [BudgetRepository],
})
export class BudgetsModule {}
