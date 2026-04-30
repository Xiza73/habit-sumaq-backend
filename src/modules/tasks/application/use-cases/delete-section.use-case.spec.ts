import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';

import { makeSection } from '../../domain/__tests__/section.factory';
import { type SectionRepository } from '../../domain/section.repository';

import { DeleteSectionUseCase } from './delete-section.use-case';

describe('DeleteSectionUseCase', () => {
  let useCase: DeleteSectionUseCase;
  let repo: jest.Mocked<SectionRepository>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn().mockResolvedValue(undefined),
      maxPositionByUserId: jest.fn(),
      updatePositions: jest.fn(),
    };
    const logger = buildMockPinoLogger();
    useCase = new DeleteSectionUseCase(repo, logger as unknown as PinoLogger);
  });

  it('deletes the section (cascade handled by FK)', async () => {
    const section = makeSection({ userId: 'user-1' });
    repo.findById.mockResolvedValue(section);
    await useCase.execute(section.id, 'user-1');
    expect(repo.deleteById).toHaveBeenCalledWith(section.id);
  });

  it('throws SECTION_NOT_FOUND when belongs to another user', async () => {
    repo.findById.mockResolvedValue(makeSection({ userId: 'someone-else' }));
    await expect(useCase.execute('id', 'user-1')).rejects.toMatchObject({
      code: 'SECTION_NOT_FOUND',
    });
    expect(repo.deleteById).not.toHaveBeenCalled();
  });
});
