import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { UserSettings } from '../../domain/user-settings.entity';
import { UserSettingsRepository } from '../../domain/user-settings.repository';

import { UserSettingsOrmEntity } from './user-settings.orm-entity';

@Injectable()
export class UserSettingsRepositoryImpl extends UserSettingsRepository {
  constructor(
    @InjectRepository(UserSettingsOrmEntity)
    private readonly ormRepo: Repository<UserSettingsOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string): Promise<UserSettings | null> {
    const orm = await this.ormRepo.findOne({ where: { userId } });
    return orm ? this.toDomain(orm) : null;
  }

  async create(userId: string): Promise<UserSettings> {
    const orm = this.ormRepo.create({ userId });
    const saved = await this.ormRepo.save(orm);
    return this.toDomain(saved);
  }

  async save(settings: UserSettings): Promise<UserSettings> {
    const saved = await this.ormRepo.save({
      id: settings.id,
      userId: settings.userId,
      language: settings.language,
      theme: settings.theme,
      defaultCurrency: settings.defaultCurrency,
      dateFormat: settings.dateFormat,
      startOfWeek: settings.startOfWeek,
      updatedAt: settings.updatedAt,
    });
    return this.toDomain(saved as UserSettingsOrmEntity);
  }

  private toDomain(orm: UserSettingsOrmEntity): UserSettings {
    return new UserSettings(
      orm.id,
      orm.userId,
      orm.language,
      orm.theme,
      orm.defaultCurrency,
      orm.dateFormat,
      orm.startOfWeek,
      orm.createdAt,
      orm.updatedAt,
    );
  }
}
