import { Injectable } from '@nestjs/common';

import { UserSettingsRepository } from '../../domain/user-settings.repository';

import type { UserSettings } from '../../domain/user-settings.entity';

@Injectable()
export class GetUserSettingsUseCase {
  constructor(private readonly settingsRepo: UserSettingsRepository) {}

  async execute(userId: string): Promise<UserSettings> {
    const existing = await this.settingsRepo.findByUserId(userId);
    if (existing) return existing;
    return this.settingsRepo.create(userId);
  }
}
