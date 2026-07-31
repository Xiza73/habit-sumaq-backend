import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CurrencyPoolsModule } from '@modules/currency-pools/presentation/currency-pools.module';
import { DebtsLoansModule } from '@modules/debts-loans/presentation/debts-loans.module';
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
 *   - `DebtsLoansModule` (shared-service-payments slice 2) for
 *     `DebtLoanSettlementComposer` — generates/settles the `LOAN`s for a
 *     shared-service pay-with-splits inside this module's own payment
 *     transaction. One-directional: `DebtsLoansModule` only imports
 *     `CurrencyPoolsModule`, so this edge introduces no cycle (no
 *     `forwardRef` needed here, unlike the `MonthlyServicesModule` edge).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MonthlyServicePaymentOrmEntity]),
    // forwardRef — see MonthlyServicesModule for the rationale.
    forwardRef(() => MonthlyServicesModule),
    CurrencyPoolsModule,
    DebtsLoansModule,
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
