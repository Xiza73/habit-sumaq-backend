import { type SectionRepository } from '../../domain/section.repository';

import { CreateSectionUseCase } from './create-section.use-case';

describe('CreateSectionUseCase', () => {
  let useCase: CreateSectionUseCase;
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
    useCase = new CreateSectionUseCase(repo);
  });

  it('appends the new section at position max+1', async () => {
    repo.maxPositionByUserId.mockResolvedValue(3);
    const result = await useCase.execute('user-1', { name: 'Personal', color: '#000000' });
    expect(result.position).toBe(4);
    expect(result.name).toBe('Personal');
    expect(result.color).toBe('#000000');
  });

  it('first section starts at position 1 (no prior sections)', async () => {
    repo.maxPositionByUserId.mockResolvedValue(null);
    const result = await useCase.execute('user-1', { name: 'Trabajo' });
    expect(result.position).toBe(1);
    expect(result.color).toBeNull();
  });
});
