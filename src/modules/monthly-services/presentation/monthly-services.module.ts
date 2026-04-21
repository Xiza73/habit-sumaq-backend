import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountsModule } from '@modules/accounts/presentation/accounts.module';
import { CategoriesModule } from '@modules/categories/presentation/categories.module';
import { TransactionsModule } from '@modules/transactions/presentation/transactions.module';

import { ArchiveMonthlyServiceUseCase } from '../application/use-cases/archive-monthly-service.use-case';
import { CreateMonthlyServiceUseCase } from '../application/use-cases/create-monthly-service.use-case';
import { DeleteMonthlyServiceUseCase } from '../application/use-cases/delete-monthly-service.use-case';
import { GetMonthlyServiceUseCase } from '../application/use-cases/get-monthly-service.use-case';
import { ListMonthlyServicesUseCase } from '../application/use-cases/list-monthly-services.use-case';
import { PayMonthlyServiceUseCase } from '../application/use-cases/pay-monthly-service.use-case';
import { SkipMonthlyServiceMonthUseCase } from '../application/use-cases/skip-monthly-service-month.use-case';
import { UpdateMonthlyServiceUseCase } from '../application/use-cases/update-monthly-service.use-case';
import { MonthlyServiceRepository } from '../domain/monthly-service.repository';
import { MonthlyServiceOrmEntity } from '../infrastructure/persistence/monthly-service.orm-entity';
import { MonthlyServiceRepositoryImpl } from '../infrastructure/persistence/monthly-service.repository.impl';

import { MonthlyServicesController } from './monthly-services.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonthlyServiceOrmEntity]),
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
  ],
  controllers: [MonthlyServicesController],
  providers: [
    { provide: MonthlyServiceRepository, useClass: MonthlyServiceRepositoryImpl },
    ListMonthlyServicesUseCase,
    GetMonthlyServiceUseCase,
    CreateMonthlyServiceUseCase,
    UpdateMonthlyServiceUseCase,
    PayMonthlyServiceUseCase,
    SkipMonthlyServiceMonthUseCase,
    ArchiveMonthlyServiceUseCase,
    DeleteMonthlyServiceUseCase,
  ],
  exports: [MonthlyServiceRepository],
})
export class MonthlyServicesModule {}
