import { buildUserSettings } from '../../domain/__tests__/user-settings.factory';

import { GetUserSettingsUseCase } from './get-user-settings.use-case';

import type { UserSettingsRepository } from '../../domain/user-settings.repository';

describe('GetUserSettingsUseCase', () => {
  let useCase: GetUserSettingsUseCase;
  let mockRepo: jest.Mocked<UserSettingsRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    useCase = new GetUserSettingsUseCase(mockRepo);
  });

  it('should return existing settings', async () => {
    const settings = buildUserSettings({ userId: 'user-1' });
    mockRepo.findByUserId.mockResolvedValue(settings);

    const result = await useCase.execute('user-1');

    expect(result).toBe(settings);
    expect(mockRepo.findByUserId).toHaveBeenCalledWith('user-1');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('should create default settings when none exist', async () => {
    const newSettings = buildUserSettings({ userId: 'user-1' });
    mockRepo.findByUserId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(newSettings);

    const result = await useCase.execute('user-1');

    expect(result).toBe(newSettings);
    expect(mockRepo.create).toHaveBeenCalledWith('user-1');
  });
});
