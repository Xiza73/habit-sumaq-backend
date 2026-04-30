import { makeSection } from '../../domain/__tests__/section.factory';
import { type SectionRepository } from '../../domain/section.repository';

import { UpdateSectionUseCase } from './update-section.use-case';

describe('UpdateSectionUseCase', () => {
  let useCase: UpdateSectionUseCase;
  let repo: jest.Mocked<SectionRepository>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      deleteById: jest.fn(),
      maxPositionByUserId: jest.fn(),
      updatePositions: jest.fn(),
    };
    useCase = new UpdateSectionUseCase(repo);
  });

  it('updates name + color', async () => {
    const section = makeSection({ userId: 'user-1', name: 'Old', color: null });
    repo.findById.mockResolvedValue(section);
    const result = await useCase.execute(section.id, 'user-1', {
      name: 'New',
      color: '#123456',
    });
    expect(result.name).toBe('New');
    expect(result.color).toBe('#123456');
  });

  it('throws SECTION_NOT_FOUND when belongs to another user', async () => {
    repo.findById.mockResolvedValue(makeSection({ userId: 'someone-else' }));
    await expect(useCase.execute('id', 'user-1', { name: 'New' })).rejects.toMatchObject({
      code: 'SECTION_NOT_FOUND',
    });
  });

  it('throws SECTION_NOT_FOUND when section does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('id', 'user-1', { name: 'X' })).rejects.toMatchObject({
      code: 'SECTION_NOT_FOUND',
    });
  });
});
