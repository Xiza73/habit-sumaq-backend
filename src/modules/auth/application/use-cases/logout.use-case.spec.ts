import { createHash } from 'node:crypto';

import { buildRefreshToken } from '../../domain/__tests__/refresh-token.factory';

import { LogoutUseCase } from './logout.use-case';

import type { RefreshTokenRepository } from '../../domain/refresh-token.repository';

const RAW_TOKEN = 'some-raw-token';
const HASHED_TOKEN = createHash('sha256').update(RAW_TOKEN).digest('hex');

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
  let mockRefreshTokenRepo: jest.Mocked<RefreshTokenRepository>;

  beforeEach(() => {
    mockRefreshTokenRepo = {
      create: jest.fn(),
      findByHashedToken: jest.fn(),
      revoke: jest.fn().mockResolvedValue(undefined),
      revokeAllByUserId: jest.fn(),
    };
    useCase = new LogoutUseCase(mockRefreshTokenRepo);
  });

  describe('execute', () => {
    it('should revoke the active refresh token', async () => {
      const stored = buildRefreshToken({ token: HASHED_TOKEN, revokedAt: null });
      mockRefreshTokenRepo.findByHashedToken.mockResolvedValue(stored);

      await useCase.execute(RAW_TOKEN);

      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith(stored.id);
    });

    it('should do nothing when token is undefined (already logged out)', async () => {
      await useCase.execute(undefined);

      expect(mockRefreshTokenRepo.findByHashedToken).not.toHaveBeenCalled();
      expect(mockRefreshTokenRepo.revoke).not.toHaveBeenCalled();
    });

    it('should do nothing when token is not found in DB', async () => {
      mockRefreshTokenRepo.findByHashedToken.mockResolvedValue(null);

      await useCase.execute(RAW_TOKEN);

      expect(mockRefreshTokenRepo.revoke).not.toHaveBeenCalled();
    });

    it('should not revoke an already revoked token', async () => {
      const already = buildRefreshToken({ token: HASHED_TOKEN, revokedAt: new Date() });
      mockRefreshTokenRepo.findByHashedToken.mockResolvedValue(already);

      await useCase.execute(RAW_TOKEN);

      expect(mockRefreshTokenRepo.revoke).not.toHaveBeenCalled();
    });
  });
});
