import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CurrencyPoolsModule } from '@modules/currency-pools/presentation/currency-pools.module';

import { BulkSettleByReferenceUseCase } from '../application/use-cases/bulk-settle-by-reference.use-case';
import { CreateDebtLoanUseCase } from '../application/use-cases/create-debt-loan.use-case';
import { DeleteDebtLoanUseCase } from '../application/use-cases/delete-debt-loan.use-case';
import { GetDebtLoanUseCase } from '../application/use-cases/get-debt-loan.use-case';
import { GetDebtsSummaryUseCase } from '../application/use-cases/get-debts-summary.use-case';
import { ListDebtsLoansUseCase } from '../application/use-cases/list-debts-loans.use-case';
import { SettleDebtLoanUseCase } from '../application/use-cases/settle-debt-loan.use-case';
import { UpdateDebtLoanUseCase } from '../application/use-cases/update-debt-loan.use-case';
import { DebtLoanRepository } from '../domain/debt-loan.repository';
import { DebtLoanOrmEntity } from '../infrastructure/persistence/debt-loan.orm-entity';
import { DebtLoanRepositoryImpl } from '../infrastructure/persistence/debt-loan.repository.impl';

import { DebtsLoansController } from './debts-loans.controller';

/**
 * Native `debts_loans` module. Replaza el subset DEBT/LOAN del módulo
 * legacy `transactions` durante el refactor v1.0.0
 * `accounts-to-modular-finance` (Phase A3-B).
 *
 * Importa `CurrencyPoolsModule` para usar `CurrencyPoolService` en los
 * settle real-payment. No exporta su propio repo — ningún otro módulo
 * (todavía) consume debts_loans directamente; Phase A5 cablea reports
 * cuando llegue el momento.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DebtLoanOrmEntity]), CurrencyPoolsModule],
  controllers: [DebtsLoansController],
  providers: [
    { provide: DebtLoanRepository, useClass: DebtLoanRepositoryImpl },
    ListDebtsLoansUseCase,
    GetDebtLoanUseCase,
    GetDebtsSummaryUseCase,
    CreateDebtLoanUseCase,
    UpdateDebtLoanUseCase,
    DeleteDebtLoanUseCase,
    SettleDebtLoanUseCase,
    BulkSettleByReferenceUseCase,
  ],
  exports: [DebtLoanRepository],
})
export class DebtsLoansModule {}
