import { DomainException } from '@common/exceptions/domain.exception';

import { buildUser } from '../../domain/__tests__/user.factory';

import { GetUserProfileUseCase } from './get-user-profile.use-case';

import type { UserRepository } from '../../domain/user.repository';

describe('GetUserProfileUseCase', () => {
  let useCase: GetUserProfileUseCase;
  let mockRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepo = {
      findByGoogleId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    useCase = new GetUserProfileUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should return user when found', async () => {
      const user = buildUser({ id: 'user-1' });
      mockRepo.findById.mockResolvedValue(user);

      const result = await useCase.execute('user-1');

      expect(result).toBe(user);
      expect(mockRepo.findById).toHaveBeenCalledWith('user-1');
    });

    it('should throw DomainException USER_NOT_FOUND when user does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute('unknown-id')).rejects.toThrow(DomainException);
      await expect(useCase.execute('unknown-id')).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });
});
