import { Module } from '@nestjs/common';

import { AccountsModule } from '../../accounts/presentation/accounts.module';
import { BudgetMovementsModule } from '../../budget-movements/presentation/budget-movements.module';
import { CurrencyPoolsModule } from '../../currency-pools/presentation/currency-pools.module';
import { HabitsModule } from '../../habits/presentation/habits.module';
import { MonthlyServicePaymentsModule } from '../../monthly-service-payments/presentation/monthly-service-payments.module';
import { QuickTasksModule } from '../../quick-tasks/presentation/quick-tasks.module';
import { TransactionsModule } from '../../transactions/presentation/transactions.module';
import { UsersModule } from '../../users/presentation/users.module';
import { GetFinancesDashboardUseCase } from '../application/use-cases/get-finances-dashboard.use-case';
import { GetRoutinesDashboardUseCase } from '../application/use-cases/get-routines-dashboard.use-case';

import { ReportsController } from './reports.controller';

@Module({
  // Reports aggregates — it imports the feature modules that own the repos
  // we read from. Each of those modules must export the repositories we
  // depend on.
  imports: [
    UsersModule,
    AccountsModule,
    CurrencyPoolsModule,
    BudgetMovementsModule,
    MonthlyServicePaymentsModule,
    TransactionsModule,
    HabitsModule,
    QuickTasksModule,
  ],
  controllers: [ReportsController],
  providers: [GetFinancesDashboardUseCase, GetRoutinesDashboardUseCase],
})
export class ReportsModule {}
