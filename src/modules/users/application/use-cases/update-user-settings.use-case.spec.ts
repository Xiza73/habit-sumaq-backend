import { Currency } from '@common/enums/currency.enum';

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

  it('should update timezone', async () => {
    const settings = buildUserSettings({ userId: 'user-1', timezone: 'UTC' });
    mockRepo.findByUserId.mockResolvedValue(settings);
    mockRepo.save.mockResolvedValue(settings);

    const result = await useCase.execute('user-1', { timezone: 'America/Lima' });

    expect(result.timezone).toBe('America/Lima');
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should update favoriteKeys (drives the user-pickable mobile bottom nav)', async () => {
    const settings = buildUserSettings({ userId: 'user-1' });
    mockRepo.findByUserId.mockResolvedValue(settings);
    mockRepo.save.mockResolvedValue(settings);

    const result = await useCase.execute('user-1', {
      favoriteKeys: ['budgets', 'services', 'habits', 'tasks'],
    });

    expect(result.favoriteKeys).toEqual(['budgets', 'services', 'habits', 'tasks']);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should allow clearing favoriteKeys to an empty array (mobile then renders only Settings)', async () => {
    // A user might want to unpin everything — empty array is a valid state
    // per the spec. The DTO validator already allows it (`@ArrayMaxSize(4)`
    // permits 0..4). Confirm the use case threads it through unchanged.
    const settings = buildUserSettings({
      userId: 'user-1',
      favoriteKeys: ['accounts', 'transactions', 'habits', 'quick-tasks'],
    });
    mockRepo.findByUserId.mockResolvedValue(settings);
    mockRepo.save.mockResolvedValue(settings);

    const result = await useCase.execute('user-1', { favoriteKeys: [] });

    expect(result.favoriteKeys).toEqual([]);
  });
});
