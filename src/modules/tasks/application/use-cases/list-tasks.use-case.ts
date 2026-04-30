import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { Task } from '../../domain/task.entity';
import { TaskRepository } from '../../domain/task.repository';
import {
  type StartOfWeek,
  startOfWeekInTimezone,
} from '../../infrastructure/timezone/start-of-week-utc';

/**
 * Returns the user's tasks after a lazy weekly cleanup: completed tasks
 * whose `completedAt` is earlier than the start of the current week (in the
 * user's timezone, respecting their `startOfWeek` preference) are
 * hard-deleted. Incomplete tasks survive across week boundaries.
 *
 * Mirrors `GetQuickTasksUseCase` but at week granularity instead of daily.
 */
@Injectable()
export class ListTasksUseCase {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly settingsRepo: UserSettingsRepository,
    @InjectPinoLogger(ListTasksUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(userId: string): Promise<Task[]> {
    const settings = await this.settingsRepo.findByUserId(userId);
    const timezone = settings?.timezone ?? 'UTC';
    const startOfWeek = (settings?.startOfWeek as StartOfWeek | undefined) ?? 'monday';
    const weekStart = startOfWeekInTimezone(timezone, startOfWeek);

    const deleted = await this.taskRepo.deleteCompletedBefore(userId, weekStart);
    if (deleted > 0) {
      this.logger.info(
        { event: 'task.cleanup', userId, deleted, timezone, startOfWeek },
        'task.cleanup',
      );
    }

    return this.taskRepo.findByUserId(userId);
  }
}
