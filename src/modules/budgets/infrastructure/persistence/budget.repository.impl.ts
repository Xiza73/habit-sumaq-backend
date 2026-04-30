import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Budget } from '../../domain/budget.entity';
import { BudgetRepository } from '../../domain/budget.repository';

import { BudgetOrmEntity } from './budget.orm-entity';

@Injectable()
export class BudgetRepositoryImpl extends BudgetRepository {
  constructor(
    @InjectRepository(BudgetOrmEntity)
    private readonly repo: Repository<BudgetOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string): Promise<Budget[]> {
    const rows = await this.repo.find({
      where: { userId },
      // Newest period first; tie-break by currency for deterministic ordering
      // when a user has e.g. PEN + USD budgets in the same month.
      order: { year: 'DESC', month: 'DESC', currency: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Budget | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByPeriodAndCurrency(
    userId: string,
    year: number,
    month: number,
    currency: string,
  ): Promise<Budget | null> {
    const row = await this.repo.findOne({ where: { userId, year, month, currency } });
    return row ? this.toDomain(row) : null;
  }

  async save(budget: Budget): Promise<Budget> {
    const entity = this.repo.create({
      id: budget.id,
      userId: budget.userId,
      year: budget.year,
      month: budget.month,
      currency: budget.currency,
      amount: budget.amount,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
      deletedAt: budget.deletedAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  private toDomain(entity: BudgetOrmEntity): Budget {
    return new Budget(
      entity.id,
      entity.userId,
      entity.year,
      entity.month,
      entity.currency,
      entity.amount,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
