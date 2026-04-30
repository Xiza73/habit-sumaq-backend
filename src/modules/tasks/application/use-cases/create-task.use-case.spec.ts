import { makeSection } from '../../domain/__tests__/section.factory';
import { type SectionRepository } from '../../domain/section.repository';
import { type TaskRepository } from '../../domain/task.repository';

import { CreateTaskUseCase } from './create-task.use-case';

describe('CreateTaskUseCase', () => {
  let useCase: CreateTaskUseCase;
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
      maxPositionInSection: jest.fn().mockResolvedValue(null),
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
    useCase = new CreateTaskUseCase(taskRepo, sectionRepo);
  });

  it('creates a task at the end of the section', async () => {
    const section = makeSection({ id: 'sec-1', userId: 'user-1' });
    sectionRepo.findById.mockResolvedValue(section);
    taskRepo.maxPositionInSection.mockResolvedValue(2);

    const task = await useCase.execute('user-1', {
      sectionId: 'sec-1',
      title: 'Llamar al banco',
      description: null,
    });

    expect(task.position).toBe(3);
    expect(task.sectionId).toBe('sec-1');
    expect(task.completed).toBe(false);
    expect(task.completedAt).toBeNull();
  });

  it('throws SECTION_NOT_FOUND when section belongs to another user', async () => {
    sectionRepo.findById.mockResolvedValue(makeSection({ userId: 'someone-else' }));
    await expect(
      useCase.execute('user-1', { sectionId: 'sec-1', title: 'X' }),
    ).rejects.toMatchObject({ code: 'SECTION_NOT_FOUND' });
  });
});
