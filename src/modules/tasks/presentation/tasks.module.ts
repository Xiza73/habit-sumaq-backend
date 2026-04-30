import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../../users/presentation/users.module';
import { CreateSectionUseCase } from '../application/use-cases/create-section.use-case';
import { CreateTaskUseCase } from '../application/use-cases/create-task.use-case';
import { DeleteSectionUseCase } from '../application/use-cases/delete-section.use-case';
import { DeleteTaskUseCase } from '../application/use-cases/delete-task.use-case';
import { ListSectionsUseCase } from '../application/use-cases/list-sections.use-case';
import { ListTasksUseCase } from '../application/use-cases/list-tasks.use-case';
import { ReorderSectionsUseCase } from '../application/use-cases/reorder-sections.use-case';
import { ReorderTasksUseCase } from '../application/use-cases/reorder-tasks.use-case';
import { UpdateSectionUseCase } from '../application/use-cases/update-section.use-case';
import { UpdateTaskUseCase } from '../application/use-cases/update-task.use-case';
import { SectionRepository } from '../domain/section.repository';
import { TaskRepository } from '../domain/task.repository';
import { SectionOrmEntity } from '../infrastructure/persistence/section.orm-entity';
import { SectionRepositoryImpl } from '../infrastructure/persistence/section.repository.impl';
import { TaskOrmEntity } from '../infrastructure/persistence/task.orm-entity';
import { TaskRepositoryImpl } from '../infrastructure/persistence/task.repository.impl';

import { SectionsController } from './sections.controller';
import { TasksController } from './tasks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SectionOrmEntity, TaskOrmEntity]), UsersModule],
  controllers: [SectionsController, TasksController],
  providers: [
    { provide: SectionRepository, useClass: SectionRepositoryImpl },
    { provide: TaskRepository, useClass: TaskRepositoryImpl },
    ListSectionsUseCase,
    CreateSectionUseCase,
    UpdateSectionUseCase,
    DeleteSectionUseCase,
    ReorderSectionsUseCase,
    ListTasksUseCase,
    CreateTaskUseCase,
    UpdateTaskUseCase,
    DeleteTaskUseCase,
    ReorderTasksUseCase,
  ],
  exports: [SectionRepository, TaskRepository],
})
export class TasksModule {}
