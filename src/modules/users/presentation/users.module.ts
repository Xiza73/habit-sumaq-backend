import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FindOrCreateUserUseCase } from '../application/use-cases/find-or-create-user.use-case';
import { GetUserProfileUseCase } from '../application/use-cases/get-user-profile.use-case';
import { UserRepository } from '../domain/user.repository';
import { UserOrmEntity } from '../infrastructure/persistence/user.orm-entity';
import { UserRepositoryImpl } from '../infrastructure/persistence/user.repository.impl';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  providers: [
    FindOrCreateUserUseCase,
    GetUserProfileUseCase,
    { provide: UserRepository, useClass: UserRepositoryImpl },
  ],
  exports: [FindOrCreateUserUseCase, GetUserProfileUseCase],
})
export class UsersModule {}
