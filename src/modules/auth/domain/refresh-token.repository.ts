import type { RefreshToken } from './refresh-token.entity';

export interface CreateRefreshTokenData {
  userId: string;
  hashedToken: string;
  expiresAt: Date;
}

export abstract class RefreshTokenRepository {
  abstract create(data: CreateRefreshTokenData): Promise<RefreshToken>;
  abstract findByHashedToken(hashedToken: string): Promise<RefreshToken | null>;
  abstract revoke(id: string): Promise<void>;
  abstract revokeAllByUserId(userId: string): Promise<void>;
}
