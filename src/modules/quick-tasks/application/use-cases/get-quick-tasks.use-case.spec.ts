import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { buildUserSettings } from '@modules/users/domain/__tests__/user-settings.factory';
import { type UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { buildQuickTask } from '../../domain/__tests__/quick-task.factory';
import { type QuickTaskRepository } from '../../domain/quick-task.repository';

import { GetQuickTasksUseCase } from './get-quick-tasks.use-case';

describe('GetQuickTasksUseCase', () => {
  let useCase: GetQuickTasksUseCase;
  let taskRepo: jest.Mocked<QuickTaskRepository>;
  let settingsRepo: jest.Mocked<UserSettingsRepository>;

  beforeEach(() => {
    taskRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn(),
      deleteCompletedBefore: jest.fn().mockResolvedValue(0),
      maxPositionByUserId: jest.fn(),
      updatePositions: jest.fn(),
    } as jest.Mocked<QuickTaskRepository>;

    settingsRepo = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as jest.Mocked<UserSettingsRepository>;

    useCase = new GetQuickTasksUseCase(
      taskRepo,
      settingsRepo,
      buildMockPinoLogger() as unknown as PinoLogger,
    );
  });

  it('uses the user timezone when computing the cleanup cutoff', async () => {
    settingsRepo.findByUserId.mockResolvedValue(
      buildUserSettings({ userId: 'user-1', timezone: 'America/Lima' }),
    );
    await useCase.execute('user-1');

    expect(taskRepo.deleteCompletedBefore).toHaveBeenCalledWith('user-1', expect.any(Date));
  });

  it('falls back to UTC when the user has no settings row yet', async () => {
    settingsRepo.findByUserId.mockResolvedValue(null);
    await useCase.execute('user-1');

    expect(taskRepo.deleteCompletedBefore).toHaveBeenCalledWith('user-1', expect.any(Date));
  });

  it('returns the remaining tasks after cleanup', async () => {
    settingsRepo.findByUserId.mockResolvedValue(null);
    const survivor = buildQuickTask({ id: 'tk-1', userId: 'user-1' });
    taskRepo.findByUserId.mockResolvedValue([survivor]);

    const result = await useCase.execute('user-1');

    expect(result).toEqual([survivor]);
  });
});
