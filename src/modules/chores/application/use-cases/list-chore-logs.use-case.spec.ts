import { DomainException } from '@common/exceptions/domain.exception';

import { buildChore } from '../../domain/__tests__/chore.factory';
import { buildChoreLog } from '../../domain/__tests__/chore-log.factory';
import { type ChoreRepository } from '../../domain/chore.repository';
import { type ChoreLogRepository } from '../../domain/chore-log.repository';

import { ListChoreLogsUseCase } from './list-chore-logs.use-case';

describe('ListChoreLogsUseCase', () => {
  let useCase: ListChoreLogsUseCase;
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

    useCase = new ListChoreLogsUseCase(choreRepo, logRepo);
  });

  it('returns paginated logs when the chore belongs to the user', async () => {
    const chore = buildChore({ id: 'chore-1', userId });
    const logs = [buildChoreLog({ choreId: chore.id }), buildChoreLog({ choreId: chore.id })];
    choreRepo.findById.mockResolvedValue(chore);
    logRepo.findByChoreId.mockResolvedValue({ data: logs, total: 5 });

    const result = await useCase.execute(chore.id, userId, 20, 0);

    expect(result).toEqual({ data: logs, total: 5 });
    expect(logRepo.findByChoreId).toHaveBeenCalledWith(chore.id, 20, 0);
  });

  it('forwards limit and offset verbatim to the repo', async () => {
    const chore = buildChore({ id: 'chore-1', userId });
    choreRepo.findById.mockResolvedValue(chore);
    logRepo.findByChoreId.mockResolvedValue({ data: [], total: 0 });

    await useCase.execute(chore.id, userId, 50, 100);

    expect(logRepo.findByChoreId).toHaveBeenCalledWith(chore.id, 50, 100);
  });

  it('throws CHORE_NOT_FOUND when the chore does not exist', async () => {
    choreRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId, 20, 0)).rejects.toThrow(DomainException);
    expect(logRepo.findByChoreId).not.toHaveBeenCalled();
  });

  it('hides chores owned by another user behind CHORE_NOT_FOUND', async () => {
    choreRepo.findById.mockResolvedValue(buildChore({ userId: 'other' }));

    await expect(useCase.execute('x', userId, 20, 0)).rejects.toThrow('Tarea no encontrada');
    expect(logRepo.findByChoreId).not.toHaveBeenCalled();
  });
});
