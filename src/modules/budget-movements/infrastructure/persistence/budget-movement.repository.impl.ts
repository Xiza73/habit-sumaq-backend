import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { type EntityManager, IsNull, Repository } from 'typeorm';

import { BudgetMovement } from '../../domain/budget-movement.entity';
import { BudgetMovementRepository } from '../../domain/budget-movement.repository';

import { BudgetMovementOrmEntity } from './budget-movement.orm-entity';

@Injectable()
export class BudgetMovementRepositoryImpl extends BudgetMovementRepository {
  constructor(
    @InjectRepository(BudgetMovementOrmEntity)
    private readonly ormRepo: Repository<BudgetMovementOrmEntity>,
  ) {
    super();
  }

  async findByBudgetId(budgetId: string): Promise<BudgetMovement[]> {
    const rows = await this.ormRepo.find({
      where: { budgetId, deletedAt: IsNull() },
      order: { date: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<BudgetMovement | null> {
    const row = await this.ormRepo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async sumByBudgetId(budgetId: string): Promise<number> {
    const result = await this.ormRepo
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.amount), 0)', 'total')
      .where('m.budgetId = :budgetId', { budgetId })
      .andWhere('m.deletedAt IS NULL')
      .getRawOne<{ total: string }>();
    return Number(result?.total ?? 0);
  }

  async save(movement: BudgetMovement, manager?: EntityManager): Promise<BudgetMovement> {
    const m = manager ?? this.ormRepo.manager;
    const saved = await m.save(BudgetMovementOrmEntity, {
      id: movement.id,
      userId: movement.userId,
      budgetId: movement.budgetId,
      categoryId: movement.categoryId,
      currency: movement.currency,
      amount: movement.amount,
      description: movement.description,
      date: movement.date,
      createdAt: movement.createdAt,
      updatedAt: movement.updatedAt,
      deletedAt: movement.deletedAt,
    });
    return this.toDomain(saved);
  }

  async softDelete(id: string, manager?: EntityManager): Promise<void> {
    const m = manager ?? this.ormRepo.manager;
    await m.softDelete(BudgetMovementOrmEntity, id);
  }

  private toDomain(orm: BudgetMovementOrmEntity): BudgetMovement {
    return new BudgetMovement(
      orm.id,
      orm.userId,
      orm.budgetId,
      orm.categoryId,
      orm.currency,
      typeof orm.amount === 'string' ? Number(orm.amount) : orm.amount,
      orm.description,
      orm.date,
      orm.createdAt,
      orm.updatedAt,
      orm.deletedAt,
    );
  }
}
