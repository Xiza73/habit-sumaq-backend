import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountsModule } from '@modules/accounts/presentation/accounts.module';

import { CreateTransactionUseCase } from '../application/use-cases/create-transaction.use-case';
import { DeleteTransactionUseCase } from '../application/use-cases/delete-transaction.use-case';
import { GetDebtsSummaryUseCase } from '../application/use-cases/get-debts-summary.use-case';
import { GetTransactionByIdUseCase } from '../application/use-cases/get-transaction-by-id.use-case';
import { GetTransactionsUseCase } from '../application/use-cases/get-transactions.use-case';
import { SettleTransactionUseCase } from '../application/use-cases/settle-transaction.use-case';
import { UpdateTransactionUseCase } from '../application/use-cases/update-transaction.use-case';
import { TransactionRepository } from '../domain/transaction.repository';
import { TransactionOrmEntity } from '../infrastructure/persistence/transaction.orm-entity';
import { TransactionRepositoryImpl } from '../infrastructure/persistence/transaction.repository.impl';

import { TransactionsController } from './transactions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TransactionOrmEntity]), AccountsModule],
  controllers: [TransactionsController],
  providers: [
    { provide: TransactionRepository, useClass: TransactionRepositoryImpl },
    CreateTransactionUseCase,
    GetTransactionsUseCase,
    GetTransactionByIdUseCase,
    UpdateTransactionUseCase,
    DeleteTransactionUseCase,
    SettleTransactionUseCase,
    GetDebtsSummaryUseCase,
  ],
  exports: [TransactionRepository],
})
export class TransactionsModule {}
