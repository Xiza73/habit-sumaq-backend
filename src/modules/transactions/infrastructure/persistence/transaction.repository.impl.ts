import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Transaction } from '../../domain/transaction.entity';
import {
  type TransactionFilters,
  TransactionRepository,
} from '../../domain/transaction.repository';

import { TransactionOrmEntity } from './transaction.orm-entity';

@Injectable()
export class TransactionRepositoryImpl extends TransactionRepository {
  constructor(
    @InjectRepository(TransactionOrmEntity)
    private readonly repo: Repository<TransactionOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string, filters?: TransactionFilters): Promise<Transaction[]> {
    const qb = this.repo.createQueryBuilder('tx').where('tx.userId = :userId', { userId });

    if (filters?.accountId) {
      qb.andWhere('tx.accountId = :accountId', { accountId: filters.accountId });
    }
    if (filters?.categoryId) {
      qb.andWhere('tx.categoryId = :categoryId', { categoryId: filters.categoryId });
    }
    if (filters?.type) {
      qb.andWhere('tx.type = :type', { type: filters.type });
    }
    if (filters?.dateFrom) {
      qb.andWhere('tx.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('tx.date <= :dateTo', { dateTo: filters.dateTo });
    }

    qb.orderBy('tx.date', 'DESC');

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async findById(id: string): Promise<Transaction | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(transaction: Transaction): Promise<Transaction> {
    const entity = this.repo.create({
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      date: transaction.date,
      destinationAccountId: transaction.destinationAccountId,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      deletedAt: transaction.deletedAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  async existsByAccountId(accountId: string): Promise<boolean> {
    const count = await this.repo.count({ where: { accountId } });
    return count > 0;
  }

  private toDomain(entity: TransactionOrmEntity): Transaction {
    return new Transaction(
      entity.id,
      entity.userId,
      entity.accountId,
      entity.categoryId,
      entity.type,
      entity.amount,
      entity.description,
      entity.date,
      entity.destinationAccountId,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
