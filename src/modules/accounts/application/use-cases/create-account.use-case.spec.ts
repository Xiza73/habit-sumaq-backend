import { DomainException } from '@common/exceptions/domain.exception';

import { buildAccount } from '../../domain/__tests__/account.factory';
import { type AccountRepository } from '../../domain/account.repository';
import { AccountType } from '../../domain/enums/account-type.enum';
import { Currency } from '../../domain/enums/currency.enum';

import { CreateAccountUseCase } from './create-account.use-case';

import type { CreateAccountDto } from '../dto/create-account.dto';

describe('CreateAccountUseCase', () => {
  let useCase: CreateAccountUseCase;
  let mockRepo: jest.Mocked<AccountRepository>;

  const dto: CreateAccountDto = {
    name: 'Cuenta BCP',
    type: AccountType.CHECKING,
    currency: Currency.PEN,
  };

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new CreateAccountUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should create account with provided initialBalance', async () => {
      mockRepo.findByUserIdAndName.mockResolvedValue(null);
      mockRepo.save.mockImplementation(async (a) => await Promise.resolve(a));

      const result = await useCase.execute('user-1', { ...dto, initialBalance: 500 });

      expect(result.balance).toBe(500);
      expect(result.name).toBe(dto.name);
      expect(result.userId).toBe('user-1');
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should create account with balance 0 when initialBalance is not provided', async () => {
      mockRepo.findByUserIdAndName.mockResolvedValue(null);
      mockRepo.save.mockImplementation(async (a) => await Promise.resolve(a));

      const result = await useCase.execute('user-1', dto);

      expect(result.balance).toBe(0);
    });

    it('should throw ACCOUNT_NAME_TAKEN when name already exists for the user', async () => {
      mockRepo.findByUserIdAndName.mockResolvedValue(buildAccount({ name: dto.name }));

      await expect(useCase.execute('user-1', dto)).rejects.toThrow(DomainException);
    });
  });
});
