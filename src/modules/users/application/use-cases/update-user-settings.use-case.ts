import { Injectable } from '@nestjs/common';

import { UserSettingsRepository } from '../../domain/user-settings.repository';

import type { UserSettings } from '../../domain/user-settings.entity';
import type { UpdateUserSettingsDto } from '../dto/update-user-settings.dto';

@Injectable()
export class UpdateUserSettingsUseCase {
  constructor(private readonly settingsRepo: UserSettingsRepository) {}

  async execute(userId: string, dto: UpdateUserSettingsDto): Promise<UserSettings> {
    let settings = await this.settingsRepo.findByUserId(userId);
    if (!settings) {
      settings = await this.settingsRepo.create(userId);
    }
    settings.update(dto);
    return this.settingsRepo.save(settings);
  }
}
