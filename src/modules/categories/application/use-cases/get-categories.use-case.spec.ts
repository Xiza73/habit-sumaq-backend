import { buildCategory } from '../../domain/__tests__/category.factory';
import { type CategoryRepository } from '../../domain/category.repository';
import { CategoryType } from '../../domain/enums/category-type.enum';

import { GetCategoriesUseCase } from './get-categories.use-case';

describe('GetCategoriesUseCase', () => {
  let useCase: GetCategoriesUseCase;
  let mockRepo: jest.Mocked<CategoryRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new GetCategoriesUseCase(mockRepo);
  });

  it('should return all categories for the user', async () => {
    const categories = [buildCategory(), buildCategory()];
    mockRepo.findByUserId.mockResolvedValue(categories);

    const result = await useCase.execute('user-1', {});

    expect(result).toBe(categories);
    expect(mockRepo.findByUserId).toHaveBeenCalledWith('user-1', undefined);
  });

  it('should pass type filter to repository', async () => {
    mockRepo.findByUserId.mockResolvedValue([]);

    await useCase.execute('user-1', { type: CategoryType.INCOME });

    expect(mockRepo.findByUserId).toHaveBeenCalledWith('user-1', CategoryType.INCOME);
  });
});
