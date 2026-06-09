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

  async sumByCurrencyInRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ currency: string; total: number }>> {
    const rows = await this.ormRepo
      .createQueryBuilder('m')
      .select('m.currency', 'currency')
      .addSelect('COALESCE(SUM(m.amount), 0)', 'total')
      .where('m.userId = :userId', { userId })
      .andWhere('m.deletedAt IS NULL')
      .andWhere('m.date >= :from', { from })
      .andWhere('m.date < :to', { to })
      .groupBy('m.currency')
      .orderBy('m.currency', 'ASC')
      .getRawMany<{ currency: string; total: string }>();
    return rows.map((r) => ({ currency: r.currency, total: Number(r.total) }));
  }

  async topCategoriesByCurrencyInRange(
    userId: string,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<
    Array<{
      categoryId: string | null;
      name: string | null;
      color: string | null;
      currency: string;
      total: number;
    }>
  > {
    // LEFT JOIN to surface uncategorized movements (categoryId IS NULL)
    // alongside categorized ones. Uses ROW_NUMBER per currency so the
    // limit applies PER-currency, not globally — mirrors the legacy
    // `txRepo.topExpenseCategoriesInRange` behavior.
    const rows = await this.ormRepo.manager.query<
      Array<{
        categoryId: string | null;
        name: string | null;
        color: string | null;
        currency: string;
        total: string;
      }>
    >(
      `
      WITH grouped AS (
        SELECT
          m."categoryId"                     AS "categoryId",
          c.name                             AS name,
          c.color                            AS color,
          m.currency                         AS currency,
          COALESCE(SUM(m.amount), 0)         AS total
        FROM budget_movements m
        LEFT JOIN categories c ON c.id = m."categoryId"
        WHERE m."userId" = $1
          AND m."deletedAt" IS NULL
          AND m.date >= $2
          AND m.date <  $3
        GROUP BY m."categoryId", c.name, c.color, m.currency
      ),
      ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY currency ORDER BY total DESC) AS rn
        FROM grouped
      )
      SELECT "categoryId", name, color, currency, total
      FROM ranked
      WHERE rn <= $4
      ORDER BY currency ASC, total DESC
      `,
      [userId, from, to, limit],
    );
    return rows.map((r) => ({
      categoryId: r.categoryId,
      name: r.name,
      color: r.color,
      currency: r.currency,
      total: Number(r.total),
    }));
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
