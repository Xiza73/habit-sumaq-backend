import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BudgetMovementsModule } from '@modules/budget-movements/presentation/budget-movements.module';
import { BudgetsModule } from '@modules/budgets/presentation/budgets.module';
import { ChoresModule } from '@modules/chores/presentation/chores.module';
import { HabitsModule } from '@modules/habits/presentation/habits.module';
import { MonthlyServicesModule } from '@modules/monthly-services/presentation/monthly-services.module';
import { UsersModule } from '@modules/users/presentation/users.module';

import { DismissAlertUseCase } from '../application/use-cases/dismiss-alert.use-case';
import { GetAlertsForUserUseCase } from '../application/use-cases/get-alerts.use-case';
import { MarkAlertsSeenUseCase } from '../application/use-cases/mark-alerts-seen.use-case';
import { UserAlertDismissalRepository } from '../domain/user-alert-dismissal.repository';
import { UserAlertDismissalOrmEntity } from '../infrastructure/persistence/user-alert-dismissal.orm-entity';
import { UserAlertDismissalRepositoryImpl } from '../infrastructure/persistence/user-alert-dismissal.repository.impl';

import { AlertsController } from './alerts.controller';

/**
 * The alerts module consumes data from five other modules and persists
 * just one tiny piece of state (`user_alert_dismissals` + the
 * `lastAlertsSeenAt` column on user_settings — owned by `UsersModule`).
 *
 * We pull each source module's `XxxRepository` via its exports. Each one
 * already exports its repo for cross-feature use (budgets, chores,
 * habits, monthly-services, transactions); UsersModule exports
 * `UserSettingsRepository` so we can read+write `lastAlertsSeenAt`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserAlertDismissalOrmEntity]),
    BudgetMovementsModule,
    BudgetsModule,
    ChoresModule,
    HabitsModule,
    MonthlyServicesModule,
    UsersModule,
  ],
  controllers: [AlertsController],
  providers: [
    { provide: UserAlertDismissalRepository, useClass: UserAlertDismissalRepositoryImpl },
    GetAlertsForUserUseCase,
    DismissAlertUseCase,
    MarkAlertsSeenUseCase,
  ],
})
export class AlertsModule {}
