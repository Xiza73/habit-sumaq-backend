import { Injectable } from '@nestjs/common';

import { Category } from '../../domain/category.entity';
import { CategoryRepository } from '../../domain/category.repository';

import type { GetCategoriesQueryDto } from '../dto/get-categories-query.dto';

@Injectable()
export class GetCategoriesUseCase {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(userId: string, query: GetCategoriesQueryDto): Promise<Category[]> {
    return this.categoryRepo.findByUserId(userId, query.type);
  }
}
