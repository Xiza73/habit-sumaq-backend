import { DomainException } from '@common/exceptions/domain.exception';

import { buildQuickTask } from '../../domain/__tests__/quick-task.factory';
import { type QuickTaskRepository } from '../../domain/quick-task.repository';

import { DeleteQuickTaskUseCase } from './delete-quick-task.use-case';

describe('DeleteQuickTaskUseCase', () => {
  let useCase: DeleteQuickTaskUseCase;
  let mockRepo: jest.Mocked<QuickTaskRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn(),
      deleteCompletedBefore: jest.fn(),
      maxPositionByUserId: jest.fn(),
      updatePositions: jest.fn(),
    } as jest.Mocked<QuickTaskRepository>;
    useCase = new DeleteQuickTaskUseCase(mockRepo);
  });

  it('hard-deletes when owner matches', async () => {
    const task = buildQuickTask({ userId: 'user-1' });
    mockRepo.findById.mockResolvedValue(task);

    await useCase.execute(task.id, 'user-1');

    expect(mockRepo.deleteById).toHaveBeenCalledWith(task.id);
  });

  it('throws NOT_FOUND when missing', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('x', 'user-1')).rejects.toThrow(DomainException);
  });

  it('throws BELONGS_TO_OTHER_USER when owner differs', async () => {
    const task = buildQuickTask({ userId: 'other-user' });
    mockRepo.findById.mockResolvedValue(task);
    await expect(useCase.execute(task.id, 'user-1')).rejects.toThrow(DomainException);
    expect(mockRepo.deleteById).not.toHaveBeenCalled();
  });
});
