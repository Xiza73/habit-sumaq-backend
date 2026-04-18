import { type ConfigService } from '@nestjs/config';
import { type JwtService } from '@nestjs/jwt';

import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { DomainException } from '@common/exceptions/domain.exception';

import { buildUser } from '../../../users/domain/__tests__/user.factory';
import { buildRefreshToken } from '../../domain/__tests__/refresh-token.factory';

import { GoogleLoginUseCase } from './google-login.use-case';

import type { RefreshTokenRepository } from '../../domain/refresh-token.repository';

describe('GoogleLoginUseCase', () => {
  let useCase: GoogleLoginUseCase;
  let mockJwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let mockConfig: jest.Mocked<Pick<ConfigService, 'get'>>;
  let mockRefreshTokenRepo: jest.Mocked<RefreshTokenRepository>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  beforeEach(() => {
    mockJwtService = { sign: jest.fn().mockReturnValue('mocked-access-token') };
    mockConfig = {
      get: jest.fn().mockImplementation((key: string) => {
        const map: Record<string, string> = {
          'jwt.accessSecret': 'test-secret',
          'jwt.accessExpiresIn': '15m',
          'jwt.refreshExpiresIn': '7d',
        };
        return map[key];
      }),
    };
    mockRefreshTokenRepo = {
      create: jest.fn().mockResolvedValue(buildRefreshToken()),
      findByHashedToken: jest.fn(),
      revoke: jest.fn(),
      revokeAllByUserId: jest.fn(),
    };
    mockLogger = buildMockPinoLogger();

    useCase = new GoogleLoginUseCase(
      mockJwtService as unknown as JwtService,
      mockConfig as unknown as ConfigService,
      mockRefreshTokenRepo,
      mockLogger as unknown as PinoLogger,
    );
  });

  describe('execute', () => {
    it('should return accessToken and rawRefreshToken for active user', async () => {
      const user = buildUser({ isActive: true });
      const result = await useCase.execute(user);

      expect(result.accessToken).toBe('mocked-access-token');
      expect(result.rawRefreshToken).toBeDefined();
      expect(result.rawRefreshToken.length).toBeGreaterThan(0);
      expect(mockRefreshTokenRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should store a hashed token — not the raw token', async () => {
      const user = buildUser({ isActive: true });
      const result = await useCase.execute(user);

      const { hashedToken } = mockRefreshTokenRepo.create.mock.calls[0][0];
      expect(hashedToken).not.toBe(result.rawRefreshToken);
      expect(hashedToken).toHaveLength(64); // SHA-256 hex
    });

    it('should throw USER_INACTIVE when user is not active', async () => {
      const user = buildUser({ isActive: false });

      await expect(useCase.execute(user)).rejects.toThrow(DomainException);
      await expect(useCase.execute(user)).rejects.toMatchObject({ code: 'USER_INACTIVE' });
      expect(mockRefreshTokenRepo.create).not.toHaveBeenCalled();
    });
  });
});
