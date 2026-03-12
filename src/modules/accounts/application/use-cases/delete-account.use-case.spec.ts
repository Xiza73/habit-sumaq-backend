import { DomainException } from '@common/exceptions/domain.exception';

import { buildAccount } from '../../domain/__tests__/account.factory';
import { type AccountRepository } from '../../domain/account.repository';

import { DeleteAccountUseCase } from './delete-account.use-case';

describe('DeleteAccountUseCase', () => {
  let useCase: DeleteAccountUseCase;
  let mockRepo: jest.Mocked<AccountRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new DeleteAccountUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should soft delete the account', async () => {
      const account = buildAccount({ userId: 'user-1' });
      mockRepo.findById.mockResolvedValue(account);
      mockRepo.softDelete.mockResolvedValue(undefined);

      await useCase.execute(account.id, 'user-1');

      expect(mockRepo.softDelete).toHaveBeenCalledWith(account.id);
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
