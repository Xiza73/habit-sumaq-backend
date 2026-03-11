import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { RefreshTokenRepository } from '../../domain/refresh-token.repository';

@Injectable()
export class LogoutUseCase {
  constructor(private readonly refreshTokenRepo: RefreshTokenRepository) {}

  async execute(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;

    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const stored = await this.refreshTokenRepo.findByHashedToken(hashedToken);

    if (stored && stored.revokedAt === null) {
      await this.refreshTokenRepo.revoke(stored.id);
    }
  }
}
