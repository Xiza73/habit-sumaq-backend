import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AccountsModule } from './modules/accounts/presentation/accounts.module';
import { AuthModule } from './modules/auth/presentation/auth.module';
import { BudgetsModule } from './modules/budgets/presentation/budgets.module';
import { CategoriesModule } from './modules/categories/presentation/categories.module';
import { ChoresModule } from './modules/chores/presentation/chores.module';
import { HabitsModule } from './modules/habits/presentation/habits.module';
import { HealthModule } from './modules/health/health.module';
import { MonthlyServicesModule } from './modules/monthly-services/presentation/monthly-services.module';
import { QuickTasksModule } from './modules/quick-tasks/presentation/quick-tasks.module';
import { ReportsModule } from './modules/reports/presentation/reports.module';
import { TasksModule } from './modules/tasks/presentation/tasks.module';
import { TransactionsModule } from './modules/transactions/presentation/transactions.module';
import { UsersModule } from './modules/users/presentation/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    HabitsModule,
    QuickTasksModule,
    MonthlyServicesModule,
    ChoresModule,
    BudgetsModule,
    TasksModule,
    ReportsModule,
    HealthModule,
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
export class AppModule {}
