import { makeSection } from '../../domain/__tests__/section.factory';
import { type SectionRepository } from '../../domain/section.repository';

import { ListSectionsUseCase } from './list-sections.use-case';

describe('ListSectionsUseCase', () => {
  it('returns the user sections from the repository', async () => {
    const repo: jest.Mocked<SectionRepository> = {
      findByUserId: jest.fn().mockResolvedValue([makeSection(), makeSection()]),
      findById: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn(),
      maxPositionByUserId: jest.fn(),
      updatePositions: jest.fn(),
    };
    const useCase = new ListSectionsUseCase(repo);
    const result = await useCase.execute('user-1');
    expect(result).toHaveLength(2);
    expect(repo.findByUserId).toHaveBeenCalledWith('user-1');
  });
});
