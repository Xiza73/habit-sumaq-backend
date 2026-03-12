import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Category } from '../../domain/category.entity';
import { CategoryRepository } from '../../domain/category.repository';
import { CategoryType } from '../../domain/enums/category-type.enum';

import { CategoryOrmEntity } from './category.orm-entity';

@Injectable()
export class CategoryRepositoryImpl extends CategoryRepository {
  constructor(
    @InjectRepository(CategoryOrmEntity)
    private readonly repo: Repository<CategoryOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string, type?: CategoryType): Promise<Category[]> {
    const qb = this.repo
      .createQueryBuilder('category')
      .where('category.userId = :userId', { userId });

    if (type) {
      qb.andWhere('category.type = :type', { type });
    }

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async findByUserIdAndName(userId: string, name: string): Promise<Category | null> {
    const entity = await this.repo.findOne({ where: { userId, name } });
    return entity ? this.toDomain(entity) : null;
  }

  async findById(id: string): Promise<Category | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(category: Category): Promise<Category> {
    const entity = this.repo.create({
      id: category.id,
      userId: category.userId,
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon,
      isDefault: category.isDefault,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      deletedAt: category.deletedAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  private toDomain(entity: CategoryOrmEntity): Category {
    return new Category(
      entity.id,
      entity.userId,
      entity.name,
      entity.type,
      entity.color,
      entity.icon,
      entity.isDefault,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
