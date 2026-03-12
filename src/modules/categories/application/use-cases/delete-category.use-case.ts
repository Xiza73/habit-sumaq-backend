import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { CategoryRepository } from '../../domain/category.repository';

@Injectable()
export class DeleteCategoryUseCase {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(id: string, userId: string): Promise<void> {
    const category = await this.categoryRepo.findById(id);
    if (!category) {
      throw new DomainException('CATEGORY_NOT_FOUND', 'Categoría no encontrada');
    }
    if (category.userId !== userId) {
      throw new DomainException('CATEGORY_BELONGS_TO_OTHER_USER', 'Esta categoría no te pertenece');
    }
    if (category.isDefault) {
      throw new DomainException(
        'CANNOT_DELETE_DEFAULT_CATEGORY',
        'Las categorías por defecto no pueden eliminarse',
      );
    }
    // TODO (Fase 5): verificar que no existan transacciones usando esta categoría
    await this.categoryRepo.softDelete(id);
  }
}
