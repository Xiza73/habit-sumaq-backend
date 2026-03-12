import { DomainException } from '@common/exceptions/domain.exception';

import { buildAccount } from '../../domain/__tests__/account.factory';
import { type AccountRepository } from '../../domain/account.repository';

import { ArchiveAccountUseCase } from './archive-account.use-case';

describe('ArchiveAccountUseCase', () => {
  let useCase: ArchiveAccountUseCase;
  let mockRepo: jest.Mocked<AccountRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new ArchiveAccountUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should archive the account', async () => {
      const account = buildAccount({ userId: 'user-1', isArchived: false });
      mockRepo.findById.mockResolvedValue(account);
      mockRepo.save.mockImplementation(async (a) => await Promise.resolve(a));

      const result = await useCase.execute(account.id, 'user-1');

      expect(result.isArchived).toBe(true);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should throw ACCOUNT_NOT_FOUND when account does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(DomainException);
    });

    it('should throw ACCOUNT_BELONGS_TO_OTHER_USER when account belongs to a different user', async () => {
      const account = buildAccount({ userId: 'user-2' });
      mockRepo.findById.mockResolvedValue(account);

      await expect(useCase.execute(account.id, 'user-1')).rejects.toThrow(DomainException);
    });
  });
});
