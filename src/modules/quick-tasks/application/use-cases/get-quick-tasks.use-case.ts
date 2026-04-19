import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { QuickTask } from '../../domain/quick-task.entity';
import { QuickTaskRepository } from '../../domain/quick-task.repository';
import { startOfTodayInTimezone } from '../../infrastructure/timezone/start-of-today-utc';

/**
 * Returns the user's quick tasks after a lazy cleanup: completed tasks whose
 * `completedAt` is earlier than the start of "today" in the user's timezone
 * are hard-deleted. Pending tasks persist across days.
 *
 * Timezone comes from user_settings.timezone (default 'UTC'). If the user has
 * no settings row yet, cleanup falls back to UTC midnight — acceptable because
 * the frontend creates/detects timezone on first dashboard load.
 */
@Injectable()
export class GetQuickTasksUseCase {
  constructor(
    private readonly taskRepo: QuickTaskRepository,
    private readonly settingsRepo: UserSettingsRepository,
    @InjectPinoLogger(GetQuickTasksUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(userId: string): Promise<QuickTask[]> {
    const settings = await this.settingsRepo.findByUserId(userId);
    const timezone = settings?.timezone ?? 'UTC';
    const todayStart = startOfTodayInTimezone(timezone);

    const deleted = await this.taskRepo.deleteCompletedBefore(userId, todayStart);
    if (deleted > 0) {
      this.logger.info(
        { event: 'quick_task.cleanup', userId, deleted, timezone },
        'quick_task.cleanup',
      );
    }

    return this.taskRepo.findByUserId(userId);
  }
}
