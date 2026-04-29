import { DomainException } from '@common/exceptions/domain.exception';

import { buildChore } from '../../domain/__tests__/chore.factory';
import { type ChoreRepository } from '../../domain/chore.repository';

import { ArchiveChoreUseCase } from './archive-chore.use-case';

describe('ArchiveChoreUseCase', () => {
  let useCase: ArchiveChoreUseCase;
  let repo: jest.Mocked<ChoreRepository>;

  const userId = 'user-1';

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      softDelete: jest.fn(),
    } as jest.Mocked<ChoreRepository>;
    useCase = new ArchiveChoreUseCase(repo);
  });

  it('toggles an active chore to archived', async () => {
    const chore = buildChore({ userId, isActive: true });
    repo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, userId);

    expect(result.isActive).toBe(false);
  });

  it('toggles an archived chore back to active', async () => {
    const chore = buildChore({ userId, isActive: false });
    repo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, userId);

    expect(result.isActive).toBe(true);
  });

  it('throws CHORE_NOT_FOUND on unknown id', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId)).rejects.toThrow(DomainException);
  });

  it('hides chores owned by another user behind CHORE_NOT_FOUND', async () => {
    repo.findById.mockResolvedValue(buildChore({ userId: 'other' }));

    await expect(useCase.execute('x', userId)).rejects.toThrow('Tarea no encontrada');
  });
});
