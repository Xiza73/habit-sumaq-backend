import { DomainException } from '@common/exceptions/domain.exception';

import { buildCategory } from '../../domain/__tests__/category.factory';
import { type CategoryRepository } from '../../domain/category.repository';

import { GetCategoryByIdUseCase } from './get-category-by-id.use-case';

describe('GetCategoryByIdUseCase', () => {
  let useCase: GetCategoryByIdUseCase;
  let mockRepo: jest.Mocked<CategoryRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new GetCategoryByIdUseCase(mockRepo);
  });

  it('should return the category when found and owned by user', async () => {
    const category = buildCategory({ userId: 'user-1' });
    mockRepo.findById.mockResolvedValue(category);

    const result = await useCase.execute(category.id, 'user-1');

    expect(result).toBe(category);
  });

  it('should throw CATEGORY_NOT_FOUND when category does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('non-existent', 'user-1')).rejects.toThrow(DomainException);
  });

  it('should throw CATEGORY_BELONGS_TO_OTHER_USER when userId does not match', async () => {
    const category = buildCategory({ userId: 'owner' });
    mockRepo.findById.mockResolvedValue(category);

    await expect(useCase.execute(category.id, 'intruder')).rejects.toThrow(DomainException);
  });
});
