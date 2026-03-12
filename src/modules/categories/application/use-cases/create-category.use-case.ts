import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Category } from '../../domain/category.entity';
import { CategoryRepository } from '../../domain/category.repository';

import type { CreateCategoryDto } from '../dto/create-category.dto';

@Injectable()
export class CreateCategoryUseCase {
  private readonly logger = new Logger(CreateCategoryUseCase.name);

  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.categoryRepo.findByUserIdAndName(userId, dto.name);
    if (existing) {
      throw new DomainException(
        'CATEGORY_NAME_TAKEN',
        `Ya existe una categoría llamada "${dto.name}"`,
      );
    }

    const now = new Date();
    const category = new Category(
      randomUUID(),
      userId,
      dto.name,
      dto.type,
      dto.color ?? null,
      dto.icon ?? null,
      false,
      now,
      now,
      null,
    );

    const saved = await this.categoryRepo.save(category);
    this.logger.log({ categoryId: saved.id, userId }, 'Categoría creada');
    return saved;
  }
}
