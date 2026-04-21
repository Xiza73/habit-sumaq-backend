import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreateCategoryUseCase } from '../application/use-cases/create-category.use-case';
import { DeleteCategoryUseCase } from '../application/use-cases/delete-category.use-case';
import { GetCategoriesUseCase } from '../application/use-cases/get-categories.use-case';
import { GetCategoryByIdUseCase } from '../application/use-cases/get-category-by-id.use-case';
import { UpdateCategoryUseCase } from '../application/use-cases/update-category.use-case';
import { CategoryRepository } from '../domain/category.repository';
import { CategoryOrmEntity } from '../infrastructure/persistence/category.orm-entity';
import { CategoryRepositoryImpl } from '../infrastructure/persistence/category.repository.impl';

import { CategoriesController } from './categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryOrmEntity])],
  controllers: [CategoriesController],
  providers: [
    { provide: CategoryRepository, useClass: CategoryRepositoryImpl },
    CreateCategoryUseCase,
    GetCategoriesUseCase,
    GetCategoryByIdUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
  ],
  exports: [
    CategoryRepository,
    CreateCategoryUseCase,
    GetCategoriesUseCase,
    GetCategoryByIdUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
  ],
})
export class CategoriesModule {}
