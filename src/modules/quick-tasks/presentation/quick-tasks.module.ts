import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../../users/presentation/users.module';
import { CreateQuickTaskUseCase } from '../application/use-cases/create-quick-task.use-case';
import { DeleteQuickTaskUseCase } from '../application/use-cases/delete-quick-task.use-case';
import { GetQuickTasksUseCase } from '../application/use-cases/get-quick-tasks.use-case';
import { ReorderQuickTasksUseCase } from '../application/use-cases/reorder-quick-tasks.use-case';
import { UpdateQuickTaskUseCase } from '../application/use-cases/update-quick-task.use-case';
import { QuickTaskRepository } from '../domain/quick-task.repository';
import { QuickTaskOrmEntity } from '../infrastructure/persistence/quick-task.orm-entity';
import { QuickTaskRepositoryImpl } from '../infrastructure/persistence/quick-task.repository.impl';

import { QuickTasksController } from './quick-tasks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QuickTaskOrmEntity]), UsersModule],
  controllers: [QuickTasksController],
  providers: [
    { provide: QuickTaskRepository, useClass: QuickTaskRepositoryImpl },
    GetQuickTasksUseCase,
    CreateQuickTaskUseCase,
    UpdateQuickTaskUseCase,
    DeleteQuickTaskUseCase,
    ReorderQuickTasksUseCase,
  ],
  exports: [QuickTaskRepository],
})
export class QuickTasksModule {}
