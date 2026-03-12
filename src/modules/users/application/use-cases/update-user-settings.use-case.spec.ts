import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { buildUserSettings } from '../../domain/__tests__/user-settings.factory';
import { Language } from '../../domain/enums/language.enum';
import { Theme } from '../../domain/enums/theme.enum';

import { UpdateUserSettingsUseCase } from './update-user-settings.use-case';

import type { UserSettingsRepository } from '../../domain/user-settings.repository';

describe('UpdateUserSettingsUseCase', () => {
  let useCase: UpdateUserSettingsUseCase;
  let mockRepo: jest.Mocked<UserSettingsRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    useCase = new UpdateUserSettingsUseCase(mockRepo);
  });

  it('should update existing settings', async () => {
    const settings = buildUserSettings({ userId: 'user-1' });
    mockRepo.findByUserId.mockResolvedValue(settings);
    mockRepo.save.mockResolvedValue(settings);

    const result = await useCase.execute('user-1', {
      language: Language.EN,
      theme: Theme.DARK,
    });

    expect(result.language).toBe(Language.EN);
    expect(result.theme).toBe(Theme.DARK);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should create settings if none exist then update', async () => {
    const newSettings = buildUserSettings({ userId: 'user-1' });
    mockRepo.findByUserId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(newSettings);
    mockRepo.save.mockResolvedValue(newSettings);

    const result = await useCase.execute('user-1', {
      defaultCurrency: Currency.USD,
    });

    expect(mockRepo.create).toHaveBeenCalledWith('user-1');
    expect(result.defaultCurrency).toBe(Currency.USD);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should handle empty dto without errors', async () => {
    const settings = buildUserSettings({ userId: 'user-1' });
    mockRepo.findByUserId.mockResolvedValue(settings);
    mockRepo.save.mockResolvedValue(settings);

    await useCase.execute('user-1', {});

    expect(mockRepo.save).toHaveBeenCalled();
  });
});
