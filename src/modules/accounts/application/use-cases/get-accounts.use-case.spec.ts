import { buildAccount } from '../../domain/__tests__/account.factory';
import { type AccountRepository } from '../../domain/account.repository';

import { GetAccountsUseCase } from './get-accounts.use-case';

describe('GetAccountsUseCase', () => {
  let useCase: GetAccountsUseCase;
  let mockRepo: jest.Mocked<AccountRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new GetAccountsUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should return accounts for the user (archived excluded by default)', async () => {
      const accounts = [buildAccount({ userId: 'user-1' }), buildAccount({ userId: 'user-1' })];
      mockRepo.findByUserId.mockResolvedValue(accounts);

      const result = await useCase.execute('user-1');

      expect(result).toHaveLength(2);
      expect(mockRepo.findByUserId).toHaveBeenCalledWith('user-1', false);
    });

    it('should pass includeArchived=true to repository when requested', async () => {
      mockRepo.findByUserId.mockResolvedValue([]);

      await useCase.execute('user-1', true);

      expect(mockRepo.findByUserId).toHaveBeenCalledWith('user-1', true);
    });
  });
});
