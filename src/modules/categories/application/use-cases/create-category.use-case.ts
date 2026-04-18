import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';

import { Category } from '../../domain/category.entity';
import { CategoryRepository } from '../../domain/category.repository';

import type { CreateCategoryDto } from '../dto/create-category.dto';

@Injectable()
export class CreateCategoryUseCase {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    @InjectPinoLogger(CreateCategoryUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.categoryRepo.findByUserIdAndName(userId, dto.name);
    if (existing) {
      this.logger.warn({ event: 'category.create.conflict', userId }, 'category.create.conflict');
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
    this.logger.info(
      { event: 'category.created', categoryId: saved.id, userId, type: dto.type },
      'category.created',
    );
    return saved;
  }
}
