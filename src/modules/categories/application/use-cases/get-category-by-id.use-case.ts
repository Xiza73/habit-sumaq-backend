import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Category } from '../../domain/category.entity';
import { CategoryRepository } from '../../domain/category.repository';

@Injectable()
export class GetCategoryByIdUseCase {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(id: string, userId: string): Promise<Category> {
    const category = await this.categoryRepo.findById(id);
    if (!category) {
      throw new DomainException('CATEGORY_NOT_FOUND', 'Categoría no encontrada');
    }
    if (category.userId !== userId) {
      throw new DomainException('CATEGORY_BELONGS_TO_OTHER_USER', 'Esta categoría no te pertenece');
    }
    return category;
  }
}
