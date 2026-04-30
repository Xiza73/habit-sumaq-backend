import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { StartOfWeek } from '@modules/users/domain/enums/start-of-week.enum';
import { type UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { makeTask } from '../../domain/__tests__/task.factory';
import { type TaskRepository } from '../../domain/task.repository';

import { ListTasksUseCase } from './list-tasks.use-case';

describe('ListTasksUseCase', () => {
  let useCase: ListTasksUseCase;
  let taskRepo: jest.Mocked<TaskRepository>;
  let settingsRepo: jest.Mocked<UserSettingsRepository>;

  beforeEach(() => {
    taskRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      findBySectionId: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn(),
      deleteCompletedBefore: jest.fn().mockResolvedValue(0),
      maxPositionInSection: jest.fn(),
      updatePositions: jest.fn(),
    };
    settingsRepo = {
      findByUserId: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<UserSettingsRepository>;
    const logger = buildMockPinoLogger();
    useCase = new ListTasksUseCase(taskRepo, settingsRepo, logger as unknown as PinoLogger);
  });

  it('runs lazy weekly cleanup before returning tasks', async () => {
    settingsRepo.findByUserId.mockResolvedValue({
      id: 's-1',
      userId: 'user-1',
      timezone: 'America/Lima',
      startOfWeek: StartOfWeek.MONDAY,
    } as never);
    taskRepo.deleteCompletedBefore.mockResolvedValue(3);
    taskRepo.findByUserId.mockResolvedValue([makeTask({ userId: 'user-1' })]);

    const result = await useCase.execute('user-1');
    expect(taskRepo.deleteCompletedBefore).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('falls back to UTC + monday when user has no settings', async () => {
    settingsRepo.findByUserId.mockResolvedValue(null);
    await useCase.execute('user-1');
    expect(taskRepo.deleteCompletedBefore).toHaveBeenCalledWith('user-1', expect.any(Date));
  });
});
