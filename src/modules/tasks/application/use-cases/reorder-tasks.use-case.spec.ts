import { makeSection } from '../../domain/__tests__/section.factory';
import { makeTask } from '../../domain/__tests__/task.factory';
import { type SectionRepository } from '../../domain/section.repository';
import { type TaskRepository } from '../../domain/task.repository';

import { ReorderTasksUseCase } from './reorder-tasks.use-case';

describe('ReorderTasksUseCase', () => {
  let useCase: ReorderTasksUseCase;
  let taskRepo: jest.Mocked<TaskRepository>;
  let sectionRepo: jest.Mocked<SectionRepository>;

  beforeEach(() => {
    taskRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findBySectionId: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn(),
      deleteCompletedBefore: jest.fn(),
      maxPositionInSection: jest.fn(),
      updatePositions: jest.fn().mockResolvedValue(undefined),
    };
    sectionRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn(),
      maxPositionByUserId: jest.fn(),
      updatePositions: jest.fn(),
    };
    useCase = new ReorderTasksUseCase(taskRepo, sectionRepo);
  });

  it('renumbers positions 1..N for tasks within a section', async () => {
    const section = makeSection({ id: 'sec-1', userId: 'user-1' });
    sectionRepo.findById.mockResolvedValue(section);
    taskRepo.findBySectionId.mockResolvedValue([
      makeTask({ id: 'a', sectionId: 'sec-1' }),
      makeTask({ id: 'b', sectionId: 'sec-1' }),
      makeTask({ id: 'c', sectionId: 'sec-1' }),
    ]);

    await useCase.execute('user-1', {
      sectionId: 'sec-1',
      orderedIds: ['c', 'a', 'b'],
    });

    expect(taskRepo.updatePositions).toHaveBeenCalledWith([
      { id: 'c', position: 1 },
      { id: 'a', position: 2 },
      { id: 'b', position: 3 },
    ]);
  });

  it('throws SECTION_NOT_FOUND when section belongs to another user', async () => {
    sectionRepo.findById.mockResolvedValue(makeSection({ userId: 'someone-else' }));
    await expect(
      useCase.execute('user-1', { sectionId: 'sec-1', orderedIds: ['a'] }),
    ).rejects.toMatchObject({ code: 'SECTION_NOT_FOUND' });
  });

  it('throws TASK_REORDER_INVALID_IDS when an id is not in this section', async () => {
    sectionRepo.findById.mockResolvedValue(makeSection({ id: 'sec-1', userId: 'user-1' }));
    taskRepo.findBySectionId.mockResolvedValue([makeTask({ id: 'a', sectionId: 'sec-1' })]);

    await expect(
      useCase.execute('user-1', { sectionId: 'sec-1', orderedIds: ['a', 'b'] }),
    ).rejects.toMatchObject({ code: 'TASK_REORDER_INVALID_IDS' });
  });
});
