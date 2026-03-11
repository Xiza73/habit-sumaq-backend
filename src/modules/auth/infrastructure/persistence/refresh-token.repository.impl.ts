import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { RefreshToken } from '../../domain/refresh-token.entity';
import {
  type CreateRefreshTokenData,
  RefreshTokenRepository,
} from '../../domain/refresh-token.repository';

import { RefreshTokenOrmEntity } from './refresh-token.orm-entity';

@Injectable()
export class RefreshTokenRepositoryImpl extends RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshTokenOrmEntity)
    private readonly ormRepo: Repository<RefreshTokenOrmEntity>,
  ) {
    super();
  }

  async create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    const orm = this.ormRepo.create({
      userId: data.userId,
      token: data.hashedToken,
      expiresAt: data.expiresAt,
      revokedAt: null,
    });
    const saved = await this.ormRepo.save(orm);
    return this.toDomain(saved);
  }

  async findByHashedToken(hashedToken: string): Promise<RefreshToken | null> {
    const orm = await this.ormRepo.findOne({ where: { token: hashedToken } });
    return orm ? this.toDomain(orm) : null;
  }

  async revoke(id: string): Promise<void> {
    await this.ormRepo.update(id, { revokedAt: new Date() });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.ormRepo.update({ userId, revokedAt: undefined }, { revokedAt: new Date() });
  }

  private toDomain(orm: RefreshTokenOrmEntity): RefreshToken {
    return new RefreshToken(
      orm.id,
      orm.userId,
      orm.token,
      orm.expiresAt,
      orm.revokedAt,
      orm.createdAt,
    );
  }
}
