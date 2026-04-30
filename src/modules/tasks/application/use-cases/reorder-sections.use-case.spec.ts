import { makeSection } from '../../domain/__tests__/section.factory';
import { type SectionRepository } from '../../domain/section.repository';

import { ReorderSectionsUseCase } from './reorder-sections.use-case';

describe('ReorderSectionsUseCase', () => {
  let useCase: ReorderSectionsUseCase;
  let repo: jest.Mocked<SectionRepository>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn(),
      maxPositionByUserId: jest.fn(),
      updatePositions: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new ReorderSectionsUseCase(repo);
  });

  it('renumbers positions 1..N in the given order', async () => {
    const a = makeSection({ id: 'a', userId: 'user-1', position: 1 });
    const b = makeSection({ id: 'b', userId: 'user-1', position: 2 });
    const c = makeSection({ id: 'c', userId: 'user-1', position: 3 });
    repo.findByUserId.mockResolvedValue([a, b, c]);

    await useCase.execute('user-1', { orderedIds: ['c', 'a', 'b'] });

    expect(repo.updatePositions).toHaveBeenCalledWith('user-1', [
      { id: 'c', position: 1 },
      { id: 'a', position: 2 },
      { id: 'b', position: 3 },
    ]);
  });

  it('throws SECTION_REORDER_INVALID_IDS when an id does not belong to the user', async () => {
    repo.findByUserId.mockResolvedValue([makeSection({ id: 'a', userId: 'user-1' })]);
    await expect(useCase.execute('user-1', { orderedIds: ['a', 'unknown'] })).rejects.toMatchObject(
      { code: 'SECTION_REORDER_INVALID_IDS' },
    );
  });
});
