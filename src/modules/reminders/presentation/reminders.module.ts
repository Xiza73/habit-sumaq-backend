import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../../users/presentation/users.module';
import { CreateReminderUseCase } from '../application/use-cases/create-reminder.use-case';
import { DeleteReminderUseCase } from '../application/use-cases/delete-reminder.use-case';
import { GetRemindersUseCase } from '../application/use-cases/get-reminders.use-case';
import { UpdateReminderUseCase } from '../application/use-cases/update-reminder.use-case';
import { ReminderRepository } from '../domain/reminder.repository';
import { ReminderOrmEntity } from '../infrastructure/persistence/reminder.orm-entity';
import { ReminderRepositoryImpl } from '../infrastructure/persistence/reminder.repository.impl';

import { RemindersController } from './reminders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReminderOrmEntity]), UsersModule],
  controllers: [RemindersController],
  providers: [
    { provide: ReminderRepository, useClass: ReminderRepositoryImpl },
    GetRemindersUseCase,
    CreateReminderUseCase,
    UpdateReminderUseCase,
    DeleteReminderUseCase,
  ],
  // Exported for the alerts module, which reads pending dated reminders.
  exports: [ReminderRepository],
})
export class RemindersModule {}
