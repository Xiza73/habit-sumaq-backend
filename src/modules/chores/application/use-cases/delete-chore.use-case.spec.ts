import { DomainException } from '@common/exceptions/domain.exception';

import { buildChore } from '../../domain/__tests__/chore.factory';
import { type ChoreRepository } from '../../domain/chore.repository';
import { type ChoreLogRepository } from '../../domain/chore-log.repository';

import { DeleteChoreUseCase } from './delete-chore.use-case';

describe('DeleteChoreUseCase', () => {
  let useCase: DeleteChoreUseCase;
  let choreRepo: jest.Mocked<ChoreRepository>;
  let logRepo: jest.Mocked<ChoreLogRepository>;

  const userId = 'user-1';

  beforeEach(() => {
    choreRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    } as jest.Mocked<ChoreRepository>;

    logRepo = {
      findByChoreId: jest.fn(),
      countByChoreId: jest.fn(),
      save: jest.fn(),
    } as jest.Mocked<ChoreLogRepository>;

    useCase = new DeleteChoreUseCase(choreRepo, logRepo);
  });

  it('soft-deletes a chore that has no logs', async () => {
    const chore = buildChore({ userId });
    choreRepo.findById.mockResolvedValue(chore);
    logRepo.countByChoreId.mockResolvedValue(0);

    await useCase.execute(chore.id, userId);

    expect(choreRepo.softDelete).toHaveBeenCalledWith(chore.id);
  });

  it('throws CHORE_HAS_LOGS when the chore has logs', async () => {
    const chore = buildChore({ userId });
    choreRepo.findById.mockResolvedValue(chore);
    logRepo.countByChoreId.mockResolvedValue(4);

    await expect(useCase.execute(chore.id, userId)).rejects.toThrow(DomainException);
    await expect(useCase.execute(chore.id, userId)).rejects.toThrow(
      /No se puede eliminar una tarea con eventos registrados/,
    );
    expect(choreRepo.softDelete).not.toHaveBeenCalled();
  });

  it('uses CHRE_001 as the error code when blocked by logs', async () => {
    const chore = buildChore({ userId });
    choreRepo.findById.mockResolvedValue(chore);
    logRepo.countByChoreId.mockResolvedValue(1);

    try {
      await useCase.execute(chore.id, userId);
      fail('expected DomainException');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainException);
      expect((err as DomainException).code).toBe('CHORE_HAS_LOGS');
      expect((err as DomainException).errorCode).toBe('CHRE_001');
    }
  });

  it('throws CHORE_NOT_FOUND on unknown id', async () => {
    choreRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId)).rejects.toThrow('Tarea no encontrada');
    expect(logRepo.countByChoreId).not.toHaveBeenCalled();
  });

  it('hides chores owned by another user behind CHORE_NOT_FOUND', async () => {
    choreRepo.findById.mockResolvedValue(buildChore({ userId: 'other' }));

    await expect(useCase.execute('x', userId)).rejects.toThrow('Tarea no encontrada');
  });
});
