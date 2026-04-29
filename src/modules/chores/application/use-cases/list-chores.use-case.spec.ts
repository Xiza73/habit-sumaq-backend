import { buildChore } from '../../domain/__tests__/chore.factory';
import { type ChoreRepository } from '../../domain/chore.repository';

import { ListChoresUseCase } from './list-chores.use-case';

describe('ListChoresUseCase', () => {
  let useCase: ListChoresUseCase;
  let repo: jest.Mocked<ChoreRepository>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    } as jest.Mocked<ChoreRepository>;
    useCase = new ListChoresUseCase(repo);
  });

  it('forwards includeArchived=false to the repo by default', async () => {
    const chores = [buildChore({ userId: 'user-1' })];
    repo.findByUserId.mockResolvedValue(chores);

    const result = await useCase.execute('user-1', false);

    expect(result).toEqual(chores);
    expect(repo.findByUserId).toHaveBeenCalledWith('user-1', false);
  });

  it('forwards includeArchived=true', async () => {
    repo.findByUserId.mockResolvedValue([]);
    await useCase.execute('user-1', true);
    expect(repo.findByUserId).toHaveBeenCalledWith('user-1', true);
  });

  it('returns the empty list as-is', async () => {
    repo.findByUserId.mockResolvedValue([]);
    expect(await useCase.execute('user-1', false)).toEqual([]);
  });
});
