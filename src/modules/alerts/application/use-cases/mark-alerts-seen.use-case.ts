import { Injectable } from '@nestjs/common';

import { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

/**
 * Bumps `user_settings.lastAlertsSeenAt` to `now`. Called by the frontend
 * when the user opens the alerts popover — the bell badge counts alerts
 * with `triggeredAt > lastSeenAt`, so this is what makes the badge drop
 * to zero.
 *
 * Uses the dedicated `markAlertsSeen()` method on the entity (NOT `update()`)
 * so we don't touch `updatedAt`. Touching `updatedAt` would invalidate the
 * `useUserSettings` query on the web every time the user opens the popover
 * — wasteful refetch with no payload change.
 *
 * If the user has no settings row yet, we create one and then mark — same
 * pattern as `UpdateUserSettingsUseCase`.
 */
@Injectable()
export class MarkAlertsSeenUseCase {
  constructor(private readonly userSettingsRepo: UserSettingsRepository) {}

  async execute(userId: string, now: Date = new Date()): Promise<void> {
    let settings = await this.userSettingsRepo.findByUserId(userId);
    if (!settings) {
      settings = await this.userSettingsRepo.create(userId);
    }
    settings.markAlertsSeen(now);
    await this.userSettingsRepo.save(settings);
  }
}
