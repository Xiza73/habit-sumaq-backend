import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { LessThan, Repository } from 'typeorm';

import { Task } from '../../domain/task.entity';
import { TaskRepository } from '../../domain/task.repository';

import { TaskOrmEntity } from './task.orm-entity';

@Injectable()
export class TaskRepositoryImpl extends TaskRepository {
  constructor(
    @InjectRepository(TaskOrmEntity)
    private readonly repo: Repository<TaskOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string): Promise<Task[]> {
    // Order by section position first (so the API caller gets tasks grouped
    // by section the same way the UI renders them), then by task position
    // within the section. We need a join to get section.position.
    const rows = await this.repo
      .createQueryBuilder('t')
      .innerJoin('sections', 's', 's.id = t.sectionId')
      .where('t.userId = :userId', { userId })
      .orderBy('s.position', 'ASC')
      .addOrderBy('t.position', 'ASC')
      .addOrderBy('t.createdAt', 'ASC')
      .getMany();
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Task | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findBySectionId(sectionId: string): Promise<Task[]> {
    const rows = await this.repo.find({
      where: { sectionId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async save(task: Task): Promise<Task> {
    const entity = this.repo.create({
      id: task.id,
      userId: task.userId,
      sectionId: task.sectionId,
      title: task.title,
      description: task.description,
      completed: task.completed,
      completedAt: task.completedAt,
      position: task.position,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async deleteCompletedBefore(userId: string, before: Date): Promise<number> {
    const result = await this.repo.delete({
      userId,
      completed: true,
      completedAt: LessThan(before),
    });
    return result.affected ?? 0;
  }

  async maxPositionInSection(sectionId: string): Promise<number | null> {
    const result = await this.repo
      .createQueryBuilder('t')
      .select('MAX(t.position)', 'max')
      .where('t.sectionId = :sectionId', { sectionId })
      .getRawOne<{ max: number | string | null }>();
    if (!result || result.max === null) return null;
    return typeof result.max === 'number' ? result.max : Number(result.max);
  }

  async updatePositions(updates: { id: string; position: number }[]): Promise<void> {
    if (updates.length === 0) return;
    await this.repo.manager.transaction(async (tx) => {
      for (const u of updates) {
        await tx.update(TaskOrmEntity, { id: u.id }, { position: u.position });
      }
    });
  }

  private toDomain(entity: TaskOrmEntity): Task {
    return new Task(
      entity.id,
      entity.userId,
      entity.sectionId,
      entity.title,
      entity.description,
      entity.completed,
      entity.completedAt,
      entity.position,
      entity.createdAt,
      entity.updatedAt,
    );
  }
}
