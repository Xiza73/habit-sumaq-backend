import { NotFoundException } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';

import { DomainException } from '@common/exceptions/domain.exception';

import { buildUser } from '../../../users/domain/__tests__/user.factory';

import { TestLoginUseCase } from './test-login.use-case';

import type { FindOrCreateUserUseCase } from '../../../users/application/use-cases/find-or-create-user.use-case';
import type { GoogleLoginUseCase } from './google-login.use-case';

describe('TestLoginUseCase', () => {
  let useCase: TestLoginUseCase;
  let mockConfig: jest.Mocked<Pick<ConfigService, 'get'>>;
  let mockFindOrCreateUser: jest.Mocked<Pick<FindOrCreateUserUseCase, 'execute'>>;
  let mockGoogleLogin: jest.Mocked<Pick<GoogleLoginUseCase, 'execute'>>;

  const buildConfigMock = (
    overrides: { nodeEnv?: string; enabled?: boolean } = {},
  ): jest.Mocked<Pick<ConfigService, 'get'>> => ({
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'app.nodeEnv') return overrides.nodeEnv ?? 'test';
      if (key === 'testAuth.enabled') return overrides.enabled ?? true;
      return undefined;
    }),
  });

  beforeEach(() => {
    mockConfig = buildConfigMock();
    mockFindOrCreateUser = {
      execute: jest.fn().mockResolvedValue(buildUser({ email: 'e2e@habit-sumaq.test' })),
    };
    mockGoogleLogin = {
      execute: jest.fn().mockResolvedValue({
        accessToken: 'test-access-token',
        rawRefreshToken: 'test-raw-refresh-token',
      }),
    };

    useCase = new TestLoginUseCase(
      mockConfig as unknown as ConfigService,
      mockFindOrCreateUser as unknown as FindOrCreateUserUseCase,
      mockGoogleLogin as unknown as GoogleLoginUseCase,
    );
  });

  describe('guard — NODE_ENV', () => {
    it('should throw NotFoundException when NODE_ENV is production', async () => {
      mockConfig = buildConfigMock({ nodeEnv: 'production', enabled: true });
      useCase = new TestLoginUseCase(
        mockConfig as unknown as ConfigService,
        mockFindOrCreateUser as unknown as FindOrCreateUserUseCase,
        mockGoogleLogin as unknown as GoogleLoginUseCase,
      );

      await expect(useCase.execute('e2e@habit-sumaq.test')).rejects.toThrow(NotFoundException);
      expect(mockFindOrCreateUser.execute).not.toHaveBeenCalled();
      expect(mockGoogleLogin.execute).not.toHaveBeenCalled();
    });
  });

  describe('guard — feature flag', () => {
    it('should throw NotFoundException when testAuth.enabled is false', async () => {
      mockConfig = buildConfigMock({ nodeEnv: 'test', enabled: false });
      useCase = new TestLoginUseCase(
        mockConfig as unknown as ConfigService,
        mockFindOrCreateUser as unknown as FindOrCreateUserUseCase,
        mockGoogleLogin as unknown as GoogleLoginUseCase,
      );

      await expect(useCase.execute('e2e@habit-sumaq.test')).rejects.toThrow(NotFoundException);
      expect(mockFindOrCreateUser.execute).not.toHaveBeenCalled();
      expect(mockGoogleLogin.execute).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('should return accessToken and rawRefreshToken when all guards pass', async () => {
      const result = await useCase.execute('e2e@habit-sumaq.test');

      expect(result.accessToken).toBe('test-access-token');
      expect(result.rawRefreshToken).toBe('test-raw-refresh-token');
      expect(mockFindOrCreateUser.execute).toHaveBeenCalledTimes(1);
      expect(mockGoogleLogin.execute).toHaveBeenCalledTimes(1);
    });

    it('should call findOrCreateUser with deterministic googleId prefix', async () => {
      await useCase.execute('e2e@habit-sumaq.test');

      expect(mockFindOrCreateUser.execute).toHaveBeenCalledWith({
        googleId: 'test-e2e@habit-sumaq.test',
        email: 'e2e@habit-sumaq.test',
        name: 'e2e',
        avatarUrl: null,
      });
    });

    it('should call googleLogin with the user returned by findOrCreateUser', async () => {
      const user = buildUser({ email: 'e2e@habit-sumaq.test' });
      mockFindOrCreateUser.execute.mockResolvedValueOnce(user);

      await useCase.execute('e2e@habit-sumaq.test');

      expect(mockGoogleLogin.execute).toHaveBeenCalledWith(user);
    });
  });

  describe('error propagation', () => {
    it('should propagate DomainException from googleLogin (e.g. USER_INACTIVE)', async () => {
      mockGoogleLogin.execute.mockRejectedValue(
        new DomainException('USER_INACTIVE', 'La cuenta está desactivada'),
      );

      const thrown: unknown = await useCase
        .execute('inactive@habit-sumaq.test')
        .catch((err: unknown) => err);

      expect(thrown).toBeInstanceOf(DomainException);
      expect(thrown).toMatchObject({ code: 'USER_INACTIVE' });
    });
  });
});
