import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FindOrCreateUserUseCase } from '../application/use-cases/find-or-create-user.use-case';
import { GetUserProfileUseCase } from '../application/use-cases/get-user-profile.use-case';
import { GetUserSettingsUseCase } from '../application/use-cases/get-user-settings.use-case';
import { UpdateUserSettingsUseCase } from '../application/use-cases/update-user-settings.use-case';
import { UserRepository } from '../domain/user.repository';
import { UserSettingsRepository } from '../domain/user-settings.repository';
import { UserOrmEntity } from '../infrastructure/persistence/user.orm-entity';
import { UserRepositoryImpl } from '../infrastructure/persistence/user.repository.impl';
import { UserSettingsOrmEntity } from '../infrastructure/persistence/user-settings.orm-entity';
import { UserSettingsRepositoryImpl } from '../infrastructure/persistence/user-settings.repository.impl';

import { UserSettingsController } from './user-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity, UserSettingsOrmEntity])],
  controllers: [UserSettingsController],
  providers: [
    FindOrCreateUserUseCase,
    GetUserProfileUseCase,
    GetUserSettingsUseCase,
    UpdateUserSettingsUseCase,
    { provide: UserRepository, useClass: UserRepositoryImpl },
    { provide: UserSettingsRepository, useClass: UserSettingsRepositoryImpl },
  ],
  exports: [FindOrCreateUserUseCase, GetUserProfileUseCase],
})
export class UsersModule {}
