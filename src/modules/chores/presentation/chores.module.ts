import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ArchiveChoreUseCase } from '../application/use-cases/archive-chore.use-case';
import { CreateChoreUseCase } from '../application/use-cases/create-chore.use-case';
import { DeleteChoreUseCase } from '../application/use-cases/delete-chore.use-case';
import { GetChoreUseCase } from '../application/use-cases/get-chore.use-case';
import { ListChoreLogsUseCase } from '../application/use-cases/list-chore-logs.use-case';
import { ListChoresUseCase } from '../application/use-cases/list-chores.use-case';
import { MarkChoreDoneUseCase } from '../application/use-cases/mark-chore-done.use-case';
import { SkipChoreCycleUseCase } from '../application/use-cases/skip-chore-cycle.use-case';
import { UpdateChoreUseCase } from '../application/use-cases/update-chore.use-case';
import { ChoreRepository } from '../domain/chore.repository';
import { ChoreLogRepository } from '../domain/chore-log.repository';
import { ChoreOrmEntity } from '../infrastructure/persistence/chore.orm-entity';
import { ChoreRepositoryImpl } from '../infrastructure/persistence/chore.repository.impl';
import { ChoreLogOrmEntity } from '../infrastructure/persistence/chore-log.orm-entity';
import { ChoreLogRepositoryImpl } from '../infrastructure/persistence/chore-log.repository.impl';

import { ChoresController } from './chores.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ChoreOrmEntity, ChoreLogOrmEntity])],
  controllers: [ChoresController],
  providers: [
    { provide: ChoreRepository, useClass: ChoreRepositoryImpl },
    { provide: ChoreLogRepository, useClass: ChoreLogRepositoryImpl },
    ListChoresUseCase,
    GetChoreUseCase,
    ListChoreLogsUseCase,
    CreateChoreUseCase,
    UpdateChoreUseCase,
    MarkChoreDoneUseCase,
    SkipChoreCycleUseCase,
    ArchiveChoreUseCase,
    DeleteChoreUseCase,
  ],
  exports: [ChoreRepository, ChoreLogRepository],
})
export class ChoresModule {}
