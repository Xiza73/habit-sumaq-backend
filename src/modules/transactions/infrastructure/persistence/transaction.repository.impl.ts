import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Transaction } from '../../domain/transaction.entity';
import {
  type PaginatedTransactions,
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

  async findByUserId(
    userId: string,
    filters?: TransactionFilters,
    pagination?: { page: number; limit: number },
  ): Promise<PaginatedTransactions> {
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
    if (filters?.status) {
      qb.andWhere('tx.status = :status', { status: filters.status });
    }
    if (filters?.dateFrom) {
      qb.andWhere('tx.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('tx.date <= :dateTo', { dateTo: filters.dateTo });
    }

    qb.orderBy('tx.date', 'DESC');

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [entities, total] = await qb.getManyAndCount();
    return { items: entities.map((e) => this.toDomain(e)), total };
  }

  async findById(id: string): Promise<Transaction | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByRelatedTransactionId(relatedTransactionId: string): Promise<Transaction[]> {
    const entities = await this.repo.find({ where: { relatedTransactionId } });
    return entities.map((e) => this.toDomain(e));
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
      reference: transaction.reference,
      status: transaction.status,
      relatedTransactionId: transaction.relatedTransactionId,
      remainingAmount: transaction.remainingAmount,
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
      entity.reference,
      entity.status,
      entity.relatedTransactionId,
      entity.remainingAmount,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
