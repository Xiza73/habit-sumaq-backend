import { buildUser } from '../../domain/__tests__/user.factory';

import { FindOrCreateUserUseCase, type GoogleUserProfile } from './find-or-create-user.use-case';

import type { UserRepository } from '../../domain/user.repository';

const mockProfile: GoogleUserProfile = {
  googleId: 'google-123',
  email: 'test@gmail.com',
  name: 'Test User',
  avatarUrl: 'https://example.com/avatar.jpg',
};

describe('FindOrCreateUserUseCase', () => {
  let useCase: FindOrCreateUserUseCase;
  let mockRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepo = {
      findByGoogleId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    useCase = new FindOrCreateUserUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should return existing user when googleId already exists', async () => {
      const existing = buildUser({ googleId: mockProfile.googleId });
      mockRepo.findByGoogleId.mockResolvedValue(existing);

      const result = await useCase.execute(mockProfile);

      expect(result).toBe(existing);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should create and return new user when googleId not found', async () => {
      const created = buildUser({ googleId: mockProfile.googleId, email: mockProfile.email });
      mockRepo.findByGoogleId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(created);

      const result = await useCase.execute(mockProfile);

      expect(mockRepo.create).toHaveBeenCalledWith({
        googleId: mockProfile.googleId,
        email: mockProfile.email,
        name: mockProfile.name,
        avatarUrl: mockProfile.avatarUrl,
      });
      expect(result).toBe(created);
    });

    it('should pass null avatarUrl when profile has no avatar', async () => {
      const profileWithoutAvatar: GoogleUserProfile = { ...mockProfile, avatarUrl: null };
      const created = buildUser({ avatarUrl: null });
      mockRepo.findByGoogleId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(created);

      await useCase.execute(profileWithoutAvatar);

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: null }));
    });
  });
});
