import { makeTask } from '../../domain/__tests__/task.factory';
import { type TaskRepository } from '../../domain/task.repository';

import { DeleteTaskUseCase } from './delete-task.use-case';

describe('DeleteTaskUseCase', () => {
  let useCase: DeleteTaskUseCase;
  let repo: jest.Mocked<TaskRepository>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findBySectionId: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn().mockResolvedValue(undefined),
      deleteCompletedBefore: jest.fn(),
      maxPositionInSection: jest.fn(),
      updatePositions: jest.fn(),
    };
    useCase = new DeleteTaskUseCase(repo);
  });

  it('deletes a task owned by the user', async () => {
    const task = makeTask({ userId: 'user-1' });
    repo.findById.mockResolvedValue(task);
    await useCase.execute(task.id, 'user-1');
    expect(repo.deleteById).toHaveBeenCalledWith(task.id);
  });

  it('throws TASK_NOT_FOUND when belongs to another user', async () => {
    repo.findById.mockResolvedValue(makeTask({ userId: 'someone-else' }));
    await expect(useCase.execute('id', 'user-1')).rejects.toMatchObject({
      code: 'TASK_NOT_FOUND',
    });
    expect(repo.deleteById).not.toHaveBeenCalled();
  });
});
