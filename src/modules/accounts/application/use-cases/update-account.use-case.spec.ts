import { DomainException } from '@common/exceptions/domain.exception';

import { buildAccount } from '../../domain/__tests__/account.factory';
import { type AccountRepository } from '../../domain/account.repository';

import { UpdateAccountUseCase } from './update-account.use-case';

describe('UpdateAccountUseCase', () => {
  let useCase: UpdateAccountUseCase;
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
    useCase = new UpdateAccountUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should update name, color and icon', async () => {
      const account = buildAccount({ userId: 'user-1', name: 'Viejo nombre' });
      mockRepo.findById.mockResolvedValue(account);
      mockRepo.findByUserIdAndName.mockResolvedValue(null);
      mockRepo.save.mockImplementation(async (a) => await Promise.resolve(a));

      const result = await useCase.execute(account.id, 'user-1', {
        name: 'Nuevo nombre',
        color: '#FF5733',
        icon: 'bank',
      });

      expect(result.name).toBe('Nuevo nombre');
      expect(result.color).toBe('#FF5733');
      expect(result.icon).toBe('bank');
    });

    it('should throw ACCOUNT_NOT_FOUND when account does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute('missing', 'user-1', {})).rejects.toThrow(DomainException);
    });

    it('should throw ACCOUNT_BELONGS_TO_OTHER_USER when account belongs to a different user', async () => {
      const account = buildAccount({ userId: 'user-2' });
      mockRepo.findById.mockResolvedValue(account);

      await expect(useCase.execute(account.id, 'user-1', {})).rejects.toThrow(DomainException);
    });

    it('should throw ACCOUNT_NAME_TAKEN when the new name is already taken', async () => {
      const account = buildAccount({ userId: 'user-1', name: 'Cuenta A' });
      const other = buildAccount({ userId: 'user-1', name: 'Cuenta B' });
      mockRepo.findById.mockResolvedValue(account);
      mockRepo.findByUserIdAndName.mockResolvedValue(other);

      await expect(useCase.execute(account.id, 'user-1', { name: 'Cuenta B' })).rejects.toThrow(
        DomainException,
      );
    });
  });
});
