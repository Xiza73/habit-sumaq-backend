import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoriesModule } from '@modules/categories/presentation/categories.module';
import { MonthlyServicePaymentsModule } from '@modules/monthly-service-payments/presentation/monthly-service-payments.module';

import { ArchiveMonthlyServiceUseCase } from '../application/use-cases/archive-monthly-service.use-case';
import { CreateMonthlyServiceUseCase } from '../application/use-cases/create-monthly-service.use-case';
import { DeleteMonthlyServiceUseCase } from '../application/use-cases/delete-monthly-service.use-case';
import { GetMonthlyServiceUseCase } from '../application/use-cases/get-monthly-service.use-case';
import { ListMonthlyServicesUseCase } from '../application/use-cases/list-monthly-services.use-case';
import { SkipMonthlyServiceMonthUseCase } from '../application/use-cases/skip-monthly-service-month.use-case';
import { UpdateMonthlyServiceUseCase } from '../application/use-cases/update-monthly-service.use-case';
import { MonthlyServiceRepository } from '../domain/monthly-service.repository';
import { MonthlyServiceOrmEntity } from '../infrastructure/persistence/monthly-service.orm-entity';
import { MonthlyServiceRepositoryImpl } from '../infrastructure/persistence/monthly-service.repository.impl';

import { MonthlyServicesController } from './monthly-services.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonthlyServiceOrmEntity]),
    CategoriesModule,
    // forwardRef breaks the cycle: MonthlyServicePaymentsModule imports
    // this module for `MonthlyServiceRepository`; this module needs the
    // payments module for `MonthlyServicePaymentRepository` (consumed by
    // `ListMonthlyServicesUseCase` to compute the per-service "paid amount
    // for current month" KPI from v1.0.0 payments, and by
    // `DeleteMonthlyServiceUseCase` to guard against deleting a service
    // with recorded payments).
    forwardRef(() => MonthlyServicePaymentsModule),
  ],
  controllers: [MonthlyServicesController],
  providers: [
    { provide: MonthlyServiceRepository, useClass: MonthlyServiceRepositoryImpl },
    ListMonthlyServicesUseCase,
    GetMonthlyServiceUseCase,
    CreateMonthlyServiceUseCase,
    UpdateMonthlyServiceUseCase,
    SkipMonthlyServiceMonthUseCase,
    ArchiveMonthlyServiceUseCase,
    DeleteMonthlyServiceUseCase,
  ],
  exports: [MonthlyServiceRepository],
})
export class MonthlyServicesModule {}
