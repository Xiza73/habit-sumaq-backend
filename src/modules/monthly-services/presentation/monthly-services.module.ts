import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoriesModule } from '@modules/categories/presentation/categories.module';
import { MonthlyServicePaymentsModule } from '@modules/monthly-service-payments/presentation/monthly-service-payments.module';

import { AddMonthlyServiceParticipantUseCase } from '../application/use-cases/add-monthly-service-participant.use-case';
import { ArchiveMonthlyServiceUseCase } from '../application/use-cases/archive-monthly-service.use-case';
import { CreateMonthlyServiceUseCase } from '../application/use-cases/create-monthly-service.use-case';
import { DeleteMonthlyServiceUseCase } from '../application/use-cases/delete-monthly-service.use-case';
import { GetMonthlyServiceUseCase } from '../application/use-cases/get-monthly-service.use-case';
import { ListMonthlyServiceParticipantsUseCase } from '../application/use-cases/list-monthly-service-participants.use-case';
import { ListMonthlyServicesUseCase } from '../application/use-cases/list-monthly-services.use-case';
import { RemoveMonthlyServiceParticipantUseCase } from '../application/use-cases/remove-monthly-service-participant.use-case';
import { SkipMonthlyServiceMonthUseCase } from '../application/use-cases/skip-monthly-service-month.use-case';
import { UpdateMonthlyServiceUseCase } from '../application/use-cases/update-monthly-service.use-case';
import { UpdateMonthlyServiceParticipantUseCase } from '../application/use-cases/update-monthly-service-participant.use-case';
import { MonthlyServiceRepository } from '../domain/monthly-service.repository';
import { MonthlyServiceParticipantRepository } from '../domain/repositories/monthly-service-participant.repository';
import { MonthlyServiceOrmEntity } from '../infrastructure/persistence/monthly-service.orm-entity';
import { MonthlyServiceRepositoryImpl } from '../infrastructure/persistence/monthly-service.repository.impl';
import { MonthlyServiceParticipantOrmEntity } from '../infrastructure/repositories/monthly-service-participant.orm-entity';
import { MonthlyServiceParticipantRepositoryImpl } from '../infrastructure/repositories/monthly-service-participant.repository.impl';

import { MonthlyServicesController } from './monthly-services.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonthlyServiceOrmEntity, MonthlyServiceParticipantOrmEntity]),
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
    {
      provide: MonthlyServiceParticipantRepository,
      useClass: MonthlyServiceParticipantRepositoryImpl,
    },
    ListMonthlyServicesUseCase,
    GetMonthlyServiceUseCase,
    CreateMonthlyServiceUseCase,
    UpdateMonthlyServiceUseCase,
    SkipMonthlyServiceMonthUseCase,
    ArchiveMonthlyServiceUseCase,
    DeleteMonthlyServiceUseCase,
    ListMonthlyServiceParticipantsUseCase,
    AddMonthlyServiceParticipantUseCase,
    UpdateMonthlyServiceParticipantUseCase,
    RemoveMonthlyServiceParticipantUseCase,
  ],
  exports: [MonthlyServiceRepository],
})
export class MonthlyServicesModule {}
