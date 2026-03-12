import { DomainException } from '@common/exceptions/domain.exception';

import { buildCategory } from '../../domain/__tests__/category.factory';
import { type CategoryRepository } from '../../domain/category.repository';

import { UpdateCategoryUseCase } from './update-category.use-case';

describe('UpdateCategoryUseCase', () => {
  let useCase: UpdateCategoryUseCase;
  let mockRepo: jest.Mocked<CategoryRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new UpdateCategoryUseCase(mockRepo);
  });

  it('should update name and return saved category', async () => {
    const category = buildCategory({ userId: 'user-1', name: 'Comida' });
    mockRepo.findById.mockResolvedValue(category);
    mockRepo.findByUserIdAndName.mockResolvedValue(null);
    mockRepo.save.mockImplementation(async (c) => await Promise.resolve(c));

    const result = await useCase.execute(category.id, 'user-1', { name: 'Alimentación' });

    expect(result.name).toBe('Alimentación');
  });

  it('should throw CATEGORY_NOT_FOUND when category does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('bad-id', 'user-1', { name: 'X' })).rejects.toThrow(
      DomainException,
    );
  });

  it('should throw CATEGORY_BELONGS_TO_OTHER_USER when userId does not match', async () => {
    mockRepo.findById.mockResolvedValue(buildCategory({ userId: 'owner' }));

    await expect(useCase.execute('id', 'intruder', {})).rejects.toThrow(DomainException);
  });

  it('should throw CATEGORY_NAME_TAKEN when new name is taken', async () => {
    const category = buildCategory({ userId: 'user-1', name: 'Comida' });
    mockRepo.findById.mockResolvedValue(category);
    mockRepo.findByUserIdAndName.mockResolvedValue(buildCategory({ name: 'Transporte' }));

    await expect(useCase.execute(category.id, 'user-1', { name: 'Transporte' })).rejects.toThrow(
      DomainException,
    );
  });

  it('should not check name uniqueness when name is unchanged', async () => {
    const category = buildCategory({ userId: 'user-1', name: 'Comida' });
    mockRepo.findById.mockResolvedValue(category);
    mockRepo.save.mockImplementation(async (c) => await Promise.resolve(c));

    await useCase.execute(category.id, 'user-1', { color: '#000000' });

    expect(mockRepo.findByUserIdAndName).not.toHaveBeenCalled();
  });
});
