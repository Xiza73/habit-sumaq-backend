import type { UserSettings } from './user-settings.entity';

export abstract class UserSettingsRepository {
  abstract findByUserId(userId: string): Promise<UserSettings | null>;
  abstract create(userId: string): Promise<UserSettings>;
  abstract save(settings: UserSettings): Promise<UserSettings>;
}
