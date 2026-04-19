import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { LessThan, Repository } from 'typeorm';

import { QuickTask } from '../../domain/quick-task.entity';
import { QuickTaskRepository } from '../../domain/quick-task.repository';

import { QuickTaskOrmEntity } from './quick-task.orm-entity';

@Injectable()
export class QuickTaskRepositoryImpl extends QuickTaskRepository {
  constructor(
    @InjectRepository(QuickTaskOrmEntity)
    private readonly ormRepo: Repository<QuickTaskOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string): Promise<QuickTask[]> {
    const rows = await this.ormRepo.find({
      where: { userId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<QuickTask | null> {
    const row = await this.ormRepo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async save(task: QuickTask): Promise<QuickTask> {
    const saved = await this.ormRepo.save({
      id: task.id,
      userId: task.userId,
      title: task.title,
      description: task.description,
      completed: task.completed,
      completedAt: task.completedAt,
      position: task.position,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
    return this.toDomain(saved as QuickTaskOrmEntity);
  }

  async deleteById(id: string): Promise<void> {
    await this.ormRepo.delete(id);
  }

  async deleteCompletedBefore(userId: string, before: Date): Promise<number> {
    const result = await this.ormRepo.delete({
      userId,
      completed: true,
      completedAt: LessThan(before),
    });
    return result.affected ?? 0;
  }

  async maxPositionByUserId(userId: string): Promise<number | null> {
    const row = (await this.ormRepo
      .createQueryBuilder('t')
      .select('MAX(t.position)', 'max')
      .where('t."userId" = :userId', { userId })
      .getRawOne<{ max: number | null }>()) ?? { max: null };
    return row.max === null || row.max === undefined ? null : Number(row.max);
  }

  async updatePositions(
    userId: string,
    updates: { id: string; position: number }[],
  ): Promise<void> {
    if (updates.length === 0) return;
    await this.ormRepo.manager.transaction(async (manager) => {
      for (const { id, position } of updates) {
        await manager.update(QuickTaskOrmEntity, { id, userId }, { position });
      }
    });
  }

  private toDomain(orm: QuickTaskOrmEntity): QuickTask {
    return new QuickTask(
      orm.id,
      orm.userId,
      orm.title,
      orm.description,
      orm.completed,
      orm.completedAt,
      orm.position,
      orm.createdAt,
      orm.updatedAt,
    );
  }
}
