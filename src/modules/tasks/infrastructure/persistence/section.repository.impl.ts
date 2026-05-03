import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Section } from '../../domain/section.entity';
import { SectionRepository } from '../../domain/section.repository';

import { SectionOrmEntity } from './section.orm-entity';

@Injectable()
export class SectionRepositoryImpl extends SectionRepository {
  constructor(
    @InjectRepository(SectionOrmEntity)
    private readonly repo: Repository<SectionOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string): Promise<Section[]> {
    const rows = await this.repo.find({
      where: { userId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Section | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async save(section: Section): Promise<Section> {
    const entity = this.repo.create({
      id: section.id,
      userId: section.userId,
      name: section.name,
      color: section.color,
      position: section.position,
      isCollapsed: section.isCollapsed,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async deleteById(id: string): Promise<void> {
    // Tasks cascade via the FK ON DELETE CASCADE in the migration.
    await this.repo.delete(id);
  }

  async maxPositionByUserId(userId: string): Promise<number | null> {
    const result = await this.repo
      .createQueryBuilder('s')
      .select('MAX(s.position)', 'max')
      .where('s.userId = :userId', { userId })
      .getRawOne<{ max: number | string | null }>();
    if (!result || result.max === null) return null;
    return typeof result.max === 'number' ? result.max : Number(result.max);
  }

  async updatePositions(
    userId: string,
    updates: { id: string; position: number }[],
  ): Promise<void> {
    if (updates.length === 0) return;
    await this.repo.manager.transaction(async (tx) => {
      for (const u of updates) {
        await tx.update(SectionOrmEntity, { id: u.id, userId }, { position: u.position });
      }
    });
  }

  private toDomain(entity: SectionOrmEntity): Section {
    return new Section(
      entity.id,
      entity.userId,
      entity.name,
      entity.color,
      entity.position,
      entity.isCollapsed,
      entity.createdAt,
      entity.updatedAt,
    );
  }
}
