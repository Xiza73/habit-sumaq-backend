import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { type EntityManager, Repository } from 'typeorm';

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

  async findByIdForUpdate(id: string, manager: EntityManager): Promise<Chore | null> {
    // `setLock('pessimistic_write')` emits `SELECT ... FOR UPDATE`, holding the
    // chore row for the caller's transaction so concurrent reverts serialize on
    // it. Runs through `manager` so the lock joins (and releases with) that tx.
    // QueryBuilder auto-applies the @DeleteDateColumn filter, so soft-deleted
    // chores return null (→ CHORE_NOT_FOUND), same as `findById`.
    const row = await manager
      .getRepository(ChoreOrmEntity)
      .createQueryBuilder('chore')
      .setLock('pessimistic_write')
      .where('chore.id = :id', { id })
      .getOne();
    return row ? this.toDomain(row) : null;
  }

  async save(chore: Chore, manager?: EntityManager): Promise<Chore> {
    const m = manager ?? this.repo.manager;
    const saved = await m.save(ChoreOrmEntity, {
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
