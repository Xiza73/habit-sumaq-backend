import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Transaction } from '../../domain/transaction.entity';
import {
  type DebtsSummaryRow,
  type DebtsSummaryStatusFilter,
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
    if (filters?.search && filters.search.trim() !== '') {
      // ILIKE + unaccent on description and reference so "Juán"/"juan"/"JUAN"
      // all match. Bracketed OR so it doesn't leak into unrelated WHERE clauses.
      qb.andWhere(
        `(LOWER(unaccent(COALESCE(tx.description, ''))) LIKE LOWER(unaccent(:search))
          OR LOWER(unaccent(COALESCE(tx.reference, ''))) LIKE LOWER(unaccent(:search)))`,
        { search: `%${filters.search.trim()}%` },
      );
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

  async aggregateDebtsByReference(
    userId: string,
    statusFilter: DebtsSummaryStatusFilter,
  ): Promise<DebtsSummaryRow[]> {
    const havingClause =
      statusFilter === 'pending'
        ? `HAVING COUNT(*) FILTER (WHERE status = 'PENDING') > 0`
        : statusFilter === 'settled'
          ? `HAVING COUNT(*) FILTER (WHERE status = 'PENDING') = 0
             AND COUNT(*) FILTER (WHERE status = 'SETTLED') > 0`
          : '';

    const rows = await this.repo.manager.query<
      Array<{
        reference: string;
        display_name: string;
        pending_debt: string;
        pending_loan: string;
        pending_count: string;
        settled_count: string;
      }>
    >(
      `
      SELECT
        LOWER(unaccent(reference)) AS reference,
        (array_agg(reference ORDER BY "createdAt" DESC))[1] AS display_name,
        COALESCE(SUM(
          CASE WHEN type = 'DEBT' AND status = 'PENDING' THEN "remainingAmount" ELSE 0 END
        ), 0) AS pending_debt,
        COALESCE(SUM(
          CASE WHEN type = 'LOAN' AND status = 'PENDING' THEN "remainingAmount" ELSE 0 END
        ), 0) AS pending_loan,
        COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count,
        COUNT(*) FILTER (WHERE status = 'SETTLED') AS settled_count
      FROM transactions
      WHERE "userId" = $1
        AND "deletedAt" IS NULL
        AND type IN ('DEBT', 'LOAN')
        AND reference IS NOT NULL
        AND reference <> ''
      GROUP BY LOWER(unaccent(reference))
      ${havingClause}
      ORDER BY pending_loan DESC, pending_debt DESC, display_name ASC
      `,
      [userId],
    );

    return rows.map((r) => {
      const pendingDebt = Number(r.pending_debt);
      const pendingLoan = Number(r.pending_loan);
      return {
        reference: r.reference,
        displayName: r.display_name,
        pendingDebt,
        pendingLoan,
        netOwed: pendingLoan - pendingDebt,
        pendingCount: Number(r.pending_count),
        settledCount: Number(r.settled_count),
      };
    });
  }

  async findPendingDebtOrLoanByNormalizedReference(
    userId: string,
    reference: string,
  ): Promise<Transaction[]> {
    const entities = await this.repo
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId })
      .andWhere(`tx.type IN ('DEBT', 'LOAN')`)
      .andWhere(`tx.status = 'PENDING'`)
      .andWhere('LOWER(unaccent(tx.reference)) = LOWER(unaccent(:reference))', { reference })
      .getMany();
    return entities.map((e) => this.toDomain(e));
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
