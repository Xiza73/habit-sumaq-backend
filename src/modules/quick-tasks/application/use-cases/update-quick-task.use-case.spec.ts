import { DomainException } from '@common/exceptions/domain.exception';

import { buildQuickTask } from '../../domain/__tests__/quick-task.factory';
import { type QuickTaskRepository } from '../../domain/quick-task.repository';

import { UpdateQuickTaskUseCase } from './update-quick-task.use-case';

describe('UpdateQuickTaskUseCase', () => {
  let useCase: UpdateQuickTaskUseCase;
  let mockRepo: jest.Mocked<QuickTaskRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((t) => Promise.resolve(t)),
      deleteById: jest.fn(),
      deleteCompletedBefore: jest.fn(),
      maxPositionByUserId: jest.fn(),
      updatePositions: jest.fn(),
    } as jest.Mocked<QuickTaskRepository>;
    useCase = new UpdateQuickTaskUseCase(mockRepo);
  });

  it('updates the title', async () => {
    const task = buildQuickTask({ userId: 'user-1', title: 'Old' });
    mockRepo.findById.mockResolvedValue(task);

    const result = await useCase.execute(task.id, 'user-1', { title: 'New' });

    expect(result.title).toBe('New');
  });

  it('marks completed and sets completedAt', async () => {
    const task = buildQuickTask({ userId: 'user-1', completed: false });
    mockRepo.findById.mockResolvedValue(task);

    const result = await useCase.execute(task.id, 'user-1', { completed: true });

    expect(result.completed).toBe(true);
    expect(result.completedAt).toBeInstanceOf(Date);
  });

  it('throws NOT_FOUND when task does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', 'user-1', { title: 'New' })).rejects.toThrow(DomainException);
  });

  it('throws BELONGS_TO_OTHER_USER when task is owned by someone else', async () => {
    const task = buildQuickTask({ userId: 'other-user' });
    mockRepo.findById.mockResolvedValue(task);

    await expect(useCase.execute(task.id, 'user-1', { title: 'New' })).rejects.toThrow(
      DomainException,
    );
  });
});
