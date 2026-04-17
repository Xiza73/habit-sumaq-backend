import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { RedisModule } from '../../../redis/redis.module';
import { UsersModule } from '../../users/presentation/users.module';
import { GoogleLoginUseCase } from '../application/use-cases/google-login.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { RotateRefreshTokenUseCase } from '../application/use-cases/rotate-refresh-token.use-case';
import { TestLoginUseCase } from '../application/use-cases/test-login.use-case';
import { RefreshTokenRepository } from '../domain/refresh-token.repository';
import { RefreshTokenRepositoryImpl } from '../infrastructure/persistence/refresh-token.repository.impl';
import { GoogleStrategy } from '../infrastructure/strategies/google.strategy';
import { JwtAccessStrategy } from '../infrastructure/strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from '../infrastructure/strategies/jwt-refresh.strategy';

import { AuthController } from './auth.controller';

@Module({
  imports: [
    RedisModule,
    PassportModule,
    JwtModule.register({}), // secrets se pasan en cada sign() call desde ConfigService
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    GoogleLoginUseCase,
    RotateRefreshTokenUseCase,
    LogoutUseCase,
    TestLoginUseCase,
    GoogleStrategy,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    { provide: RefreshTokenRepository, useClass: RefreshTokenRepositoryImpl },
  ],
})
export class AuthModule {}
