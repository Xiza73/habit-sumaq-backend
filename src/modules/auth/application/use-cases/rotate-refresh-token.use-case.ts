import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { DomainException } from '@common/exceptions/domain.exception';

import { RefreshTokenRepository } from '../../domain/refresh-token.repository';

import type { JwtPayload } from '../dto/jwt-payload.dto';
import type { AuthTokens } from './google-login.use-case';

@Injectable()
export class RotateRefreshTokenUseCase {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly refreshTokenRepo: RefreshTokenRepository,
  ) {}

  async execute(userId: string, email: string, rawToken: string): Promise<AuthTokens> {
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const stored = await this.refreshTokenRepo.findByHashedToken(hashedToken);

    if (!stored || !stored.isValid()) {
      throw new DomainException(
        'INVALID_REFRESH_TOKEN',
        'El refresh token es inválido o ha expirado',
      );
    }

    await this.refreshTokenRepo.revoke(stored.id);

    const payload: JwtPayload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessExpiresIn') as never,
    });

    const newRawToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get('jwt.refreshExpiresIn') as never,
    });
    const newHashedToken = createHash('sha256').update(newRawToken).digest('hex');
    const expiresAt = this.computeExpiry(this.config.get<string>('jwt.refreshExpiresIn', '7d'));

    await this.refreshTokenRepo.create({ userId, hashedToken: newHashedToken, expiresAt });

    return { accessToken, rawRefreshToken: newRawToken };
  }

  private computeExpiry(duration: string): Date {
    const unit = duration.slice(-1);
    const value = parseInt(duration.slice(0, -1), 10);
    const ms =
      unit === 'd'
        ? value * 86_400_000
        : unit === 'h'
          ? value * 3_600_000
          : unit === 'm'
            ? value * 60_000
            : value * 1_000;
    return new Date(Date.now() + ms);
  }
}
