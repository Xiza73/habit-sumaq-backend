import { DomainException } from '@common/exceptions/domain.exception';

import { buildCategory } from '../../domain/__tests__/category.factory';
import { type CategoryRepository } from '../../domain/category.repository';

import { DeleteCategoryUseCase } from './delete-category.use-case';

describe('DeleteCategoryUseCase', () => {
  let useCase: DeleteCategoryUseCase;
  let mockRepo: jest.Mocked<CategoryRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new DeleteCategoryUseCase(mockRepo);
  });

  it('should soft delete the category', async () => {
    const category = buildCategory({ userId: 'user-1', isDefault: false });
    mockRepo.findById.mockResolvedValue(category);

    await useCase.execute(category.id, 'user-1');

    expect(mockRepo.softDelete).toHaveBeenCalledWith(category.id);
  });

  it('should throw CATEGORY_NOT_FOUND when category does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('bad-id', 'user-1')).rejects.toThrow(DomainException);
  });

  it('should throw CATEGORY_BELONGS_TO_OTHER_USER when userId does not match', async () => {
    mockRepo.findById.mockResolvedValue(buildCategory({ userId: 'owner' }));

    await expect(useCase.execute('id', 'intruder')).rejects.toThrow(DomainException);
  });

  it('should throw CANNOT_DELETE_DEFAULT_CATEGORY for system default categories', async () => {
    const category = buildCategory({ userId: 'user-1', isDefault: true });
    mockRepo.findById.mockResolvedValue(category);

    await expect(useCase.execute(category.id, 'user-1')).rejects.toThrow(DomainException);
  });
});
