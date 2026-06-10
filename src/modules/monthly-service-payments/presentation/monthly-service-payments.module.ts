import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CurrencyPoolsModule } from '@modules/currency-pools/presentation/currency-pools.module';
import { MonthlyServicesModule } from '@modules/monthly-services/presentation/monthly-services.module';

import { CreateMonthlyServicePaymentUseCase } from '../application/use-cases/create-monthly-service-payment.use-case';
import { DeleteMonthlyServicePaymentUseCase } from '../application/use-cases/delete-monthly-service-payment.use-case';
import { GetMonthlyServicePaymentUseCase } from '../application/use-cases/get-monthly-service-payment.use-case';
import { ListMonthlyServicePaymentsUseCase } from '../application/use-cases/list-monthly-service-payments.use-case';
import { UpdateMonthlyServicePaymentUseCase } from '../application/use-cases/update-monthly-service-payment.use-case';
import { MonthlyServicePaymentRepository } from '../domain/monthly-service-payment.repository';
import { MonthlyServicePaymentOrmEntity } from '../infrastructure/persistence/monthly-service-payment.orm-entity';
import { MonthlyServicePaymentRepositoryImpl } from '../infrastructure/persistence/monthly-service-payment.repository.impl';

import { MonthlyServicePaymentsController } from './monthly-service-payments.controller';

/**
 * Native `monthly_service_payments` module of the v1.0.0
 * `accounts-to-modular-finance` refactor (Phase A4-B.3 + A4-B.4).
 *
 * Imports:
 *   - `MonthlyServicesModule` for `MonthlyServiceRepository`
 *     (validate ownership + currency).
 *   - `CurrencyPoolsModule` for `CurrencyPoolService` (atomic pool
 *     deltas).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MonthlyServicePaymentOrmEntity]),
    // forwardRef — see MonthlyServicesModule for the rationale.
    forwardRef(() => MonthlyServicesModule),
    CurrencyPoolsModule,
  ],
  controllers: [MonthlyServicePaymentsController],
  providers: [
    {
      provide: MonthlyServicePaymentRepository,
      useClass: MonthlyServicePaymentRepositoryImpl,
    },
    ListMonthlyServicePaymentsUseCase,
    GetMonthlyServicePaymentUseCase,
    CreateMonthlyServicePaymentUseCase,
    UpdateMonthlyServicePaymentUseCase,
    DeleteMonthlyServicePaymentUseCase,
  ],
  exports: [MonthlyServicePaymentRepository],
})
export class MonthlyServicePaymentsModule {}
