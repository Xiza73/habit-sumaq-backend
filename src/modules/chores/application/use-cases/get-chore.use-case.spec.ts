import { DomainException } from '@common/exceptions/domain.exception';

import { buildChore } from '../../domain/__tests__/chore.factory';
import { type ChoreRepository } from '../../domain/chore.repository';

import { GetChoreUseCase } from './get-chore.use-case';

describe('GetChoreUseCase', () => {
  let useCase: GetChoreUseCase;
  let repo: jest.Mocked<ChoreRepository>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    } as jest.Mocked<ChoreRepository>;
    useCase = new GetChoreUseCase(repo);
  });

  it('returns the chore when it exists and belongs to the user', async () => {
    const chore = buildChore({ userId: 'user-1' });
    repo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, 'user-1');

    expect(result).toBe(chore);
  });

  it('throws CHORE_NOT_FOUND when the id does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', 'user-1')).rejects.toThrow(DomainException);
    await expect(useCase.execute('x', 'user-1')).rejects.toThrow('Tarea no encontrada');
  });

  it('hides the existence of chores owned by other users (same error as 404)', async () => {
    const chore = buildChore({ userId: 'other-user' });
    repo.findById.mockResolvedValue(chore);

    await expect(useCase.execute(chore.id, 'user-1')).rejects.toThrow('Tarea no encontrada');
  });

  it('uses the CHORE_NOT_FOUND code (CHRE_002) — verified via the DomainException code', async () => {
    repo.findById.mockResolvedValue(null);

    try {
      await useCase.execute('x', 'user-1');
      fail('expected DomainException');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainException);
      expect((err as DomainException).code).toBe('CHORE_NOT_FOUND');
      expect((err as DomainException).errorCode).toBe('CHRE_002');
    }
  });
});
