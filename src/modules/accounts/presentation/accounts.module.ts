import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ArchiveAccountUseCase } from '../application/use-cases/archive-account.use-case';
import { CreateAccountUseCase } from '../application/use-cases/create-account.use-case';
import { DeleteAccountUseCase } from '../application/use-cases/delete-account.use-case';
import { GetAccountByIdUseCase } from '../application/use-cases/get-account-by-id.use-case';
import { GetAccountsUseCase } from '../application/use-cases/get-accounts.use-case';
import { UpdateAccountUseCase } from '../application/use-cases/update-account.use-case';
import { AccountRepository } from '../domain/account.repository';
import { AccountOrmEntity } from '../infrastructure/persistence/account.orm-entity';
import { AccountRepositoryImpl } from '../infrastructure/persistence/account.repository.impl';

import { AccountsController } from './accounts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccountOrmEntity])],
  controllers: [AccountsController],
  providers: [
    { provide: AccountRepository, useClass: AccountRepositoryImpl },
    CreateAccountUseCase,
    GetAccountsUseCase,
    GetAccountByIdUseCase,
    UpdateAccountUseCase,
    ArchiveAccountUseCase,
    DeleteAccountUseCase,
  ],
  exports: [
    AccountRepository,
    CreateAccountUseCase,
    GetAccountsUseCase,
    GetAccountByIdUseCase,
    UpdateAccountUseCase,
    ArchiveAccountUseCase,
    DeleteAccountUseCase,
  ],
})
export class AccountsModule {}
