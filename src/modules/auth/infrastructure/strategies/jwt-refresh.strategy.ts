import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import type { JwtPayload, JwtRefreshPayload } from '../../application/dto/jwt-payload.dto';
import type { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req.cookies as Record<string, string>)['refresh_token'] ?? null,
      ]),
      secretOrKey: config.getOrThrow<string>('jwt.refreshSecret'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): JwtRefreshPayload {
    const rawToken = (req.cookies as Record<string, string>)['refresh_token'];
    return { userId: payload.sub, email: payload.email, rawToken };
  }
}
