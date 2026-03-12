import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { User } from '../../domain/user.entity';
import { type CreateUserData, UserRepository } from '../../domain/user.repository';

import { UserOrmEntity } from './user.orm-entity';

@Injectable()
export class UserRepositoryImpl extends UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly ormRepo: Repository<UserOrmEntity>,
  ) {
    super();
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const orm = await this.ormRepo.findOne({ where: { googleId } });
    return orm ? this.toDomain(orm) : null;
  }

  async findById(id: string): Promise<User | null> {
    const orm = await this.ormRepo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const orm = this.ormRepo.create(data);
    const saved = await this.ormRepo.save(orm);
    return this.toDomain(saved);
  }

  async save(user: User): Promise<User> {
    const saved = await this.ormRepo.save({
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      updatedAt: user.updatedAt,
    });
    return this.toDomain(saved as UserOrmEntity);
  }

  private toDomain(orm: UserOrmEntity): User {
    return new User(
      orm.id,
      orm.googleId,
      orm.email,
      orm.name,
      orm.avatarUrl,
      orm.isActive,
      orm.createdAt,
      orm.updatedAt,
      orm.deletedAt,
    );
  }
}
