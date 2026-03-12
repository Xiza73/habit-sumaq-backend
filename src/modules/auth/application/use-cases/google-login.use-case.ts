import { createHash, randomBytes } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { DomainException } from '@common/exceptions/domain.exception';

import { RefreshTokenRepository } from '../../domain/refresh-token.repository';

import type { User } from '../../../users/domain/user.entity';
import type { JwtPayload } from '../dto/jwt-payload.dto';

export interface AuthTokens {
  accessToken: string;
  rawRefreshToken: string;
}

@Injectable()
export class GoogleLoginUseCase {
  private readonly logger = new Logger(GoogleLoginUseCase.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly refreshTokenRepo: RefreshTokenRepository,
  ) {}

  async execute(user: User): Promise<AuthTokens> {
    if (!user.isActive) {
      this.logger.warn(`Intento de login de usuario inactivo: ${user.id}`);
      throw new DomainException('USER_INACTIVE', 'La cuenta de usuario está desactivada');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessExpiresIn') as never,
    });

    const rawRefreshToken = randomBytes(64).toString('hex');
    const hashedToken = createHash('sha256').update(rawRefreshToken).digest('hex');
    const expiresAt = this.computeExpiry(this.config.get<string>('jwt.refreshExpiresIn', '7d'));

    await this.refreshTokenRepo.create({ userId: user.id, hashedToken, expiresAt });

    this.logger.log(`Login exitoso: userId=${user.id}`);
    return { accessToken, rawRefreshToken };
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
