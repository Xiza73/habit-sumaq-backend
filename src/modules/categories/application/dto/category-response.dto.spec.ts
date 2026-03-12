import { buildCategory } from '../../domain/__tests__/category.factory';
import { CategoryType } from '../../domain/enums/category-type.enum';

import { CategoryResponseDto } from './category-response.dto';

describe('CategoryResponseDto.fromDomain()', () => {
  it('should map all fields from a domain Category', () => {
    const category = buildCategory({
      name: 'Comida',
      type: CategoryType.EXPENSE,
      color: '#FF5722',
      icon: 'restaurant',
      isDefault: false,
    });

    const dto = CategoryResponseDto.fromDomain(category);

    expect(dto.id).toBe(category.id);
    expect(dto.userId).toBe(category.userId);
    expect(dto.name).toBe('Comida');
    expect(dto.type).toBe(CategoryType.EXPENSE);
    expect(dto.color).toBe('#FF5722');
    expect(dto.icon).toBe('restaurant');
    expect(dto.isDefault).toBe(false);
    expect(dto.createdAt).toBe(category.createdAt);
    expect(dto.updatedAt).toBe(category.updatedAt);
  });

  it('should not expose the deletedAt field', () => {
    const category = buildCategory();
    const dto = CategoryResponseDto.fromDomain(category);
    expect(dto).not.toHaveProperty('deletedAt');
  });

  it('should map nullable fields correctly when null', () => {
    const category = buildCategory({ color: null, icon: null });
    const dto = CategoryResponseDto.fromDomain(category);
    expect(dto.color).toBeNull();
    expect(dto.icon).toBeNull();
  });
});
