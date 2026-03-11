import { createHash } from 'node:crypto';

import { type ConfigService } from '@nestjs/config';
import { type JwtService } from '@nestjs/jwt';

import { DomainException } from '@common/exceptions/domain.exception';

import { buildRefreshToken } from '../../domain/__tests__/refresh-token.factory';

import { RotateRefreshTokenUseCase } from './rotate-refresh-token.use-case';

import type { RefreshTokenRepository } from '../../domain/refresh-token.repository';

const RAW_TOKEN = 'valid-raw-token';
const HASHED_TOKEN = createHash('sha256').update(RAW_TOKEN).digest('hex');

describe('RotateRefreshTokenUseCase', () => {
  let useCase: RotateRefreshTokenUseCase;
  let mockJwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let mockConfig: jest.Mocked<Pick<ConfigService, 'get'>>;
  let mockRefreshTokenRepo: jest.Mocked<RefreshTokenRepository>;

  beforeEach(() => {
    mockJwtService = { sign: jest.fn().mockReturnValue('new-access-token') };
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
      revoke: jest.fn().mockResolvedValue(undefined),
      revokeAllByUserId: jest.fn(),
    };

    useCase = new RotateRefreshTokenUseCase(
      mockJwtService as unknown as JwtService,
      mockConfig as unknown as ConfigService,
      mockRefreshTokenRepo,
    );
  });

  describe('execute', () => {
    it('should rotate tokens and return new pair', async () => {
      const stored = buildRefreshToken({ token: HASHED_TOKEN, revokedAt: null });
      mockRefreshTokenRepo.findByHashedToken.mockResolvedValue(stored);

      const result = await useCase.execute('user-1', 'test@test.com', RAW_TOKEN);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.rawRefreshToken).toBeDefined();
      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith(stored.id);
      expect(mockRefreshTokenRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should throw INVALID_REFRESH_TOKEN when token not found', async () => {
      mockRefreshTokenRepo.findByHashedToken.mockResolvedValue(null);

      await expect(useCase.execute('user-1', 'test@test.com', RAW_TOKEN)).rejects.toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('should throw INVALID_REFRESH_TOKEN when token is revoked', async () => {
      const revoked = buildRefreshToken({ token: HASHED_TOKEN, revokedAt: new Date() });
      mockRefreshTokenRepo.findByHashedToken.mockResolvedValue(revoked);

      await expect(useCase.execute('user-1', 'test@test.com', RAW_TOKEN)).rejects.toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('should throw INVALID_REFRESH_TOKEN when token is expired', async () => {
      const past = new Date(Date.now() - 1000);
      const expired = buildRefreshToken({ token: HASHED_TOKEN, expiresAt: past, revokedAt: null });
      mockRefreshTokenRepo.findByHashedToken.mockResolvedValue(expired);

      await expect(useCase.execute('user-1', 'test@test.com', RAW_TOKEN)).rejects.toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
      });
    });
  });
});
