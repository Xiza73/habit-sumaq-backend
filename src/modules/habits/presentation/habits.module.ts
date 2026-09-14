import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '@modules/users/presentation/users.module';

import { ArchiveHabitUseCase } from '../application/use-cases/archive-habit.use-case';
import { CreateHabitUseCase } from '../application/use-cases/create-habit.use-case';
import { DeleteHabitUseCase } from '../application/use-cases/delete-habit.use-case';
import { GetDailySummaryUseCase } from '../application/use-cases/get-daily-summary.use-case';
import { GetHabitByIdUseCase } from '../application/use-cases/get-habit-by-id.use-case';
import { GetHabitLogsUseCase } from '../application/use-cases/get-habit-logs.use-case';
import { GetHabitsUseCase } from '../application/use-cases/get-habits.use-case';
import { LogHabitUseCase } from '../application/use-cases/log-habit.use-case';
import { RescueStreakUseCase } from '../application/use-cases/rescue-streak.use-case';
import { UpdateHabitUseCase } from '../application/use-cases/update-habit.use-case';
import { HabitRepository } from '../domain/habit.repository';
import { HabitLogRepository } from '../domain/habit-log.repository';
import { HabitStreakRescueRepository } from '../domain/habit-streak-rescue.repository';
import { HabitOrmEntity } from '../infrastructure/persistence/habit.orm-entity';
import { HabitRepositoryImpl } from '../infrastructure/persistence/habit.repository.impl';
import { HabitLogOrmEntity } from '../infrastructure/persistence/habit-log.orm-entity';
import { HabitLogRepositoryImpl } from '../infrastructure/persistence/habit-log.repository.impl';
import { HabitStreakRescueOrmEntity } from '../infrastructure/persistence/habit-streak-rescue.orm-entity';
import { HabitStreakRescueRepositoryImpl } from '../infrastructure/persistence/habit-streak-rescue.repository.impl';

import { HabitsController } from './habits.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([HabitOrmEntity, HabitLogOrmEntity, HabitStreakRescueOrmEntity]),
    UsersModule,
  ],
  controllers: [HabitsController],
  providers: [
    { provide: HabitRepository, useClass: HabitRepositoryImpl },
    { provide: HabitLogRepository, useClass: HabitLogRepositoryImpl },
    { provide: HabitStreakRescueRepository, useClass: HabitStreakRescueRepositoryImpl },
    CreateHabitUseCase,
    GetHabitsUseCase,
    GetHabitByIdUseCase,
    UpdateHabitUseCase,
    ArchiveHabitUseCase,
    DeleteHabitUseCase,
    LogHabitUseCase,
    RescueStreakUseCase,
    GetHabitLogsUseCase,
    GetDailySummaryUseCase,
  ],
  exports: [HabitRepository, HabitLogRepository, HabitStreakRescueRepository],
})
export class HabitsModule {}
