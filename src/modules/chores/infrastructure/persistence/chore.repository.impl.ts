import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Chore } from '../../domain/chore.entity';
import { ChoreRepository } from '../../domain/chore.repository';

import { ChoreOrmEntity } from './chore.orm-entity';

@Injectable()
export class ChoreRepositoryImpl extends ChoreRepository {
  constructor(
    @InjectRepository(ChoreOrmEntity)
    private readonly repo: Repository<ChoreOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string, includeArchived = false): Promise<Chore[]> {
    const where = includeArchived ? { userId } : { userId, isActive: true };
    const rows = await this.repo.find({
      where,
      // Active first so the UI groups them naturally; within a group, the
      // most-overdue (lowest nextDueDate) bubbles to the top.
      order: { isActive: 'DESC', nextDueDate: 'ASC', name: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Chore | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async save(chore: Chore): Promise<Chore> {
    const entity = this.repo.create({
      id: chore.id,
      userId: chore.userId,
      name: chore.name,
      notes: chore.notes,
      category: chore.category,
      intervalValue: chore.intervalValue,
      intervalUnit: chore.intervalUnit,
      startDate: chore.startDate,
      lastDoneDate: chore.lastDoneDate,
      nextDueDate: chore.nextDueDate,
      isActive: chore.isActive,
      createdAt: chore.createdAt,
      updatedAt: chore.updatedAt,
      deletedAt: chore.deletedAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  private toDomain(entity: ChoreOrmEntity): Chore {
    return new Chore(
      entity.id,
      entity.userId,
      entity.name,
      entity.notes,
      entity.category,
      entity.intervalValue,
      entity.intervalUnit,
      entity.startDate,
      entity.lastDoneDate,
      entity.nextDueDate,
      entity.isActive,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
