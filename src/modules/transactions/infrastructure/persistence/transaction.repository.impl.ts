import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Transaction } from '../../domain/transaction.entity';
import {
  type DailyNetFlowRow,
  type DebtsSummaryRow,
  type DebtsSummaryStatusFilter,
  type FlowByCurrencyRow,
  type PaginatedTransactions,
  type TopCategoryRow,
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
        ? `HAVING COUNT(*) FILTER (WHERE tx.status = 'PENDING') > 0`
        : statusFilter === 'settled'
          ? `HAVING COUNT(*) FILTER (WHERE tx.status = 'PENDING') = 0
             AND COUNT(*) FILTER (WHERE tx.status = 'SETTLED') > 0`
          : '';

    // JOIN accounts to pull the currency. Grouping key is (normalized reference,
    // currency) so Juan-in-PEN and Juan-in-USD collapse into separate rows —
    // summing across currencies would be nonsense.
    const rows = await this.repo.manager.query<
      Array<{
        reference: string;
        currency: string;
        display_name: string;
        pending_debt: string;
        pending_loan: string;
        pending_count: string;
        settled_count: string;
      }>
    >(
      `
      SELECT
        LOWER(unaccent(tx.reference)) AS reference,
        a.currency AS currency,
        (array_agg(tx.reference ORDER BY tx."createdAt" DESC))[1] AS display_name,
        COALESCE(SUM(
          CASE WHEN tx.type = 'DEBT' AND tx.status = 'PENDING'
               THEN tx."remainingAmount" ELSE 0 END
        ), 0) AS pending_debt,
        COALESCE(SUM(
          CASE WHEN tx.type = 'LOAN' AND tx.status = 'PENDING'
               THEN tx."remainingAmount" ELSE 0 END
        ), 0) AS pending_loan,
        COUNT(*) FILTER (WHERE tx.status = 'PENDING') AS pending_count,
        COUNT(*) FILTER (WHERE tx.status = 'SETTLED') AS settled_count
      FROM transactions tx
      INNER JOIN accounts a ON a.id = tx."accountId"
      WHERE tx."userId" = $1
        AND tx."deletedAt" IS NULL
        AND tx.type IN ('DEBT', 'LOAN')
        AND tx.reference IS NOT NULL
        AND tx.reference <> ''
      GROUP BY LOWER(unaccent(tx.reference)), a.currency
      ${havingClause}
      ORDER BY pending_loan DESC, pending_debt DESC, display_name ASC, currency ASC
      `,
      [userId],
    );

    return rows.map((r) => {
      const pendingDebt = Number(r.pending_debt);
      const pendingLoan = Number(r.pending_loan);
      return {
        reference: r.reference,
        currency: r.currency,
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
    currency?: string,
  ): Promise<Transaction[]> {
    const qb = this.repo
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId })
      .andWhere(`tx.type IN ('DEBT', 'LOAN')`)
      .andWhere(`tx.status = 'PENDING'`)
      .andWhere('LOWER(unaccent(tx.reference)) = LOWER(unaccent(:reference))', { reference });

    if (currency) {
      // Narrow to a single currency bucket. Joining via the accounts table
      // because currency lives there, not on the transaction row.
      qb.innerJoin('accounts', 'a', 'a.id = tx.accountId').andWhere('a.currency = :currency', {
        currency,
      });
    }

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async sumFlowByCurrencyInRange(
    userId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<FlowByCurrencyRow[]> {
    // Excludes DEBT/LOAN (never affect balance) and TRANSFER (double-counts).
    const rows = await this.repo.manager.query<
      Array<{ currency: string; income: string; expense: string }>
    >(
      `
      SELECT
        a.currency AS currency,
        COALESCE(SUM(CASE WHEN tx.type = 'INCOME' THEN tx.amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN tx.type = 'EXPENSE' THEN tx.amount ELSE 0 END), 0) AS expense
      FROM transactions tx
      INNER JOIN accounts a ON a.id = tx."accountId"
      WHERE tx."userId" = $1
        AND tx."deletedAt" IS NULL
        AND tx.type IN ('INCOME', 'EXPENSE')
        AND tx.date >= $2
        AND tx.date <= $3
      GROUP BY a.currency
      ORDER BY a.currency ASC
      `,
      [userId, dateFrom, dateTo],
    );
    return rows.map((r) => ({
      currency: r.currency,
      income: Number(r.income),
      expense: Number(r.expense),
    }));
  }

  async topExpenseCategoriesInRange(
    userId: string,
    dateFrom: Date,
    dateTo: Date,
    limit: number,
  ): Promise<TopCategoryRow[]> {
    const rows = await this.repo.manager.query<
      Array<{
        category_id: string | null;
        name: string | null;
        color: string | null;
        currency: string;
        total: string;
      }>
    >(
      `
      SELECT
        tx."categoryId" AS category_id,
        c.name AS name,
        c.color AS color,
        a.currency AS currency,
        COALESCE(SUM(tx.amount), 0) AS total
      FROM transactions tx
      INNER JOIN accounts a ON a.id = tx."accountId"
      LEFT JOIN categories c ON c.id = tx."categoryId"
      WHERE tx."userId" = $1
        AND tx."deletedAt" IS NULL
        AND tx.type = 'EXPENSE'
        AND tx.date >= $2
        AND tx.date <= $3
      GROUP BY tx."categoryId", c.name, c.color, a.currency
      ORDER BY total DESC
      LIMIT $4
      `,
      [userId, dateFrom, dateTo, limit],
    );
    return rows.map((r) => ({
      categoryId: r.category_id,
      name: r.name,
      color: r.color,
      currency: r.currency,
      total: Number(r.total),
    }));
  }

  async dailyNetFlowInRange(
    userId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<DailyNetFlowRow[]> {
    const rows = await this.repo.manager.query<
      Array<{ date: string; currency: string; income: string; expense: string }>
    >(
      `
      SELECT
        TO_CHAR(tx.date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
        a.currency AS currency,
        COALESCE(SUM(CASE WHEN tx.type = 'INCOME' THEN tx.amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN tx.type = 'EXPENSE' THEN tx.amount ELSE 0 END), 0) AS expense
      FROM transactions tx
      INNER JOIN accounts a ON a.id = tx."accountId"
      WHERE tx."userId" = $1
        AND tx."deletedAt" IS NULL
        AND tx.type IN ('INCOME', 'EXPENSE')
        AND tx.date >= $2
        AND tx.date <= $3
      GROUP BY TO_CHAR(tx.date AT TIME ZONE 'UTC', 'YYYY-MM-DD'), a.currency
      ORDER BY date ASC, currency ASC
      `,
      [userId, dateFrom, dateTo],
    );
    return rows.map((r) => ({
      date: r.date,
      currency: r.currency,
      income: Number(r.income),
      expense: Number(r.expense),
    }));
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
