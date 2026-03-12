import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Category } from '../../domain/category.entity';
import { CategoryRepository } from '../../domain/category.repository';

import type { UpdateCategoryDto } from '../dto/update-category.dto';

@Injectable()
export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(id: string, userId: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoryRepo.findById(id);
    if (!category) {
      throw new DomainException('CATEGORY_NOT_FOUND', 'Categoría no encontrada');
    }
    if (category.userId !== userId) {
      throw new DomainException('CATEGORY_BELONGS_TO_OTHER_USER', 'Esta categoría no te pertenece');
    }

    const newName = dto.name ?? category.name;

    if (dto.name && dto.name !== category.name) {
      const duplicate = await this.categoryRepo.findByUserIdAndName(userId, dto.name);
      if (duplicate) {
        throw new DomainException(
          'CATEGORY_NAME_TAKEN',
          `Ya existe una categoría llamada "${dto.name}"`,
        );
      }
    }

    category.updateProfile(newName, dto.color, dto.icon);
    return this.categoryRepo.save(category);
  }
}
