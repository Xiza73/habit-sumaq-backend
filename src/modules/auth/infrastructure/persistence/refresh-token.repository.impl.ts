import { Inject, Injectable } from '@nestjs/common';

import { REDIS_CLIENT } from '../../../../redis/redis.constants';
import { RefreshToken } from '../../domain/refresh-token.entity';
import {
  type CreateRefreshTokenData,
  RefreshTokenRepository,
} from '../../domain/refresh-token.repository';

import type { Redis } from 'ioredis';

interface StoredToken {
  userId: string;
  expiresAt: string;
  createdAt: string;
}

const tokenKey = (hashedToken: string) => `rt:${hashedToken}`;
const userKey = (userId: string) => `rt:user:${userId}`;

@Injectable()
export class RefreshTokenRepositoryImpl extends RefreshTokenRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    const createdAt = new Date();
    const ttlSeconds = Math.max(1, Math.floor((data.expiresAt.getTime() - Date.now()) / 1000));

    const stored: StoredToken = {
      userId: data.userId,
      expiresAt: data.expiresAt.toISOString(),
      createdAt: createdAt.toISOString(),
    };

    await this.redis
      .multi()
      .set(tokenKey(data.hashedToken), JSON.stringify(stored), 'EX', ttlSeconds)
      .sadd(userKey(data.userId), data.hashedToken)
      .exec();

    // id = hashedToken — enables direct lookup in revoke()
    return new RefreshToken(data.hashedToken, data.userId, data.hashedToken, data.expiresAt, null, createdAt);
  }

  async findByHashedToken(hashedToken: string): Promise<RefreshToken | null> {
    const raw = await this.redis.get(tokenKey(hashedToken));
    if (!raw) return null;

    const stored = JSON.parse(raw) as StoredToken;
    return new RefreshToken(
      hashedToken,
      stored.userId,
      hashedToken,
      new Date(stored.expiresAt),
      null, // revoked tokens are deleted, never stored with revokedAt set
      new Date(stored.createdAt),
    );
  }

  async revoke(id: string): Promise<void> {
    // id === hashedToken in this implementation
    const raw = await this.redis.get(tokenKey(id));
    if (!raw) return;

    const stored = JSON.parse(raw) as StoredToken;
    await this.redis.multi().del(tokenKey(id)).srem(userKey(stored.userId), id).exec();
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    const hashedTokens = await this.redis.smembers(userKey(userId));
    if (hashedTokens.length === 0) return;

    const pipeline = this.redis.multi();
    for (const hashedToken of hashedTokens) {
      pipeline.del(tokenKey(hashedToken));
    }
    pipeline.del(userKey(userId));
    await pipeline.exec();
  }
}
