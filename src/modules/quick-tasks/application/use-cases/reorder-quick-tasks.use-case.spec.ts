import { DomainException } from '@common/exceptions/domain.exception';

import { buildQuickTask } from '../../domain/__tests__/quick-task.factory';
import { type QuickTaskRepository } from '../../domain/quick-task.repository';

import { ReorderQuickTasksUseCase } from './reorder-quick-tasks.use-case';

describe('ReorderQuickTasksUseCase', () => {
  let useCase: ReorderQuickTasksUseCase;
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
    useCase = new ReorderQuickTasksUseCase(mockRepo);
  });

  it('renumbers positions 1..N in the provided order', async () => {
    const t1 = buildQuickTask({ id: 'a', userId: 'user-1', position: 1 });
    const t2 = buildQuickTask({ id: 'b', userId: 'user-1', position: 2 });
    const t3 = buildQuickTask({ id: 'c', userId: 'user-1', position: 3 });
    mockRepo.findByUserId.mockResolvedValue([t1, t2, t3]);

    await useCase.execute('user-1', { orderedIds: ['c', 'a', 'b'] });

    expect(mockRepo.updatePositions).toHaveBeenCalledWith('user-1', [
      { id: 'c', position: 1 },
      { id: 'a', position: 2 },
      { id: 'b', position: 3 },
    ]);
  });

  it('rejects when payload includes an unknown id', async () => {
    const t1 = buildQuickTask({ id: 'a', userId: 'user-1' });
    mockRepo.findByUserId.mockResolvedValue([t1]);

    await expect(useCase.execute('user-1', { orderedIds: ['a', 'phantom'] })).rejects.toThrow(
      DomainException,
    );
    expect(mockRepo.updatePositions).not.toHaveBeenCalled();
  });
});
