import { makeSection } from '../../domain/__tests__/section.factory';
import { makeTask } from '../../domain/__tests__/task.factory';
import { type SectionRepository } from '../../domain/section.repository';
import { type TaskRepository } from '../../domain/task.repository';

import { UpdateTaskUseCase } from './update-task.use-case';

describe('UpdateTaskUseCase', () => {
  let useCase: UpdateTaskUseCase;
  let taskRepo: jest.Mocked<TaskRepository>;
  let sectionRepo: jest.Mocked<SectionRepository>;

  beforeEach(() => {
    taskRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findBySectionId: jest.fn(),
      save: jest.fn().mockImplementation((t) => Promise.resolve(t)),
      deleteById: jest.fn(),
      deleteCompletedBefore: jest.fn(),
      maxPositionInSection: jest.fn(),
      updatePositions: jest.fn(),
    };
    sectionRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn(),
      maxPositionByUserId: jest.fn(),
      updatePositions: jest.fn(),
    };
    useCase = new UpdateTaskUseCase(taskRepo, sectionRepo);
  });

  it('updates title + description', async () => {
    const task = makeTask({ userId: 'user-1', title: 'Old' });
    taskRepo.findById.mockResolvedValue(task);
    const result = await useCase.execute(task.id, 'user-1', {
      title: 'New',
      description: 'desc',
    });
    expect(result.title).toBe('New');
    expect(result.description).toBe('desc');
  });

  it('toggling completed sets completedAt', async () => {
    const task = makeTask({ userId: 'user-1', completed: false });
    taskRepo.findById.mockResolvedValue(task);
    const result = await useCase.execute(task.id, 'user-1', { completed: true });
    expect(result.completed).toBe(true);
    expect(result.completedAt).not.toBeNull();
  });

  it('cross-section move places task at end of target section', async () => {
    const task = makeTask({ id: 't-1', userId: 'user-1', sectionId: 'sec-1', position: 2 });
    const newSection = makeSection({ id: 'sec-2', userId: 'user-1' });
    taskRepo.findById.mockResolvedValue(task);
    sectionRepo.findById.mockResolvedValue(newSection);
    taskRepo.maxPositionInSection.mockResolvedValue(5);

    const result = await useCase.execute('t-1', 'user-1', { sectionId: 'sec-2' });
    expect(result.sectionId).toBe('sec-2');
    expect(result.position).toBe(6); // end of new section
  });

  it('throws SECTION_NOT_FOUND when target section belongs to another user', async () => {
    const task = makeTask({ userId: 'user-1', sectionId: 'sec-1' });
    taskRepo.findById.mockResolvedValue(task);
    sectionRepo.findById.mockResolvedValue(makeSection({ userId: 'someone-else' }));
    await expect(useCase.execute(task.id, 'user-1', { sectionId: 'sec-2' })).rejects.toMatchObject({
      code: 'SECTION_NOT_FOUND',
    });
  });

  it('throws TASK_NOT_FOUND when task belongs to another user', async () => {
    taskRepo.findById.mockResolvedValue(makeTask({ userId: 'someone-else' }));
    await expect(useCase.execute('id', 'user-1', { title: 'X' })).rejects.toMatchObject({
      code: 'TASK_NOT_FOUND',
    });
  });
});
