import { DomainException } from '@common/exceptions/domain.exception';

import { buildCategory } from '../../domain/__tests__/category.factory';
import { type CategoryRepository } from '../../domain/category.repository';
import { CategoryType } from '../../domain/enums/category-type.enum';

import { CreateCategoryUseCase } from './create-category.use-case';

import type { CreateCategoryDto } from '../dto/create-category.dto';

describe('CreateCategoryUseCase', () => {
  let useCase: CreateCategoryUseCase;
  let mockRepo: jest.Mocked<CategoryRepository>;

  const dto: CreateCategoryDto = {
    name: 'Comida',
    type: CategoryType.EXPENSE,
  };

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new CreateCategoryUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should create a category with provided color and icon', async () => {
      mockRepo.findByUserIdAndName.mockResolvedValue(null);
      mockRepo.save.mockImplementation(async (c) => await Promise.resolve(c));

      const result = await useCase.execute('user-1', {
        ...dto,
        color: '#FF5722',
        icon: 'restaurant',
      });

      expect(result.name).toBe('Comida');
      expect(result.userId).toBe('user-1');
      expect(result.color).toBe('#FF5722');
      expect(result.icon).toBe('restaurant');
      expect(result.isDefault).toBe(false);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should create category with null color/icon when not provided', async () => {
      mockRepo.findByUserIdAndName.mockResolvedValue(null);
      mockRepo.save.mockImplementation(async (c) => await Promise.resolve(c));

      const result = await useCase.execute('user-1', dto);

      expect(result.color).toBeNull();
      expect(result.icon).toBeNull();
    });

    it('should throw CATEGORY_NAME_TAKEN when name already exists for the user', async () => {
      mockRepo.findByUserIdAndName.mockResolvedValue(buildCategory({ name: dto.name }));

      await expect(useCase.execute('user-1', dto)).rejects.toThrow(DomainException);
    });
  });
});
