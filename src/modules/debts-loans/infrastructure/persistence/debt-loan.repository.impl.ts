import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { type EntityManager, In, IsNull, Repository } from 'typeorm';

import { type Currency } from '@common/enums/currency.enum';

import { DebtLoan } from '../../domain/debt-loan.entity';
import {
  DebtLoanRepository,
  type DebtLoanStatusFilter,
  type DebtsSummaryRow,
} from '../../domain/debt-loan.repository';
import { DebtLoanStatus } from '../../domain/enums/debt-loan-status.enum';
import { type DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

import { DebtLoanOrmEntity } from './debt-loan.orm-entity';

@Injectable()
export class DebtLoanRepositoryImpl extends DebtLoanRepository {
  constructor(
    @InjectRepository(DebtLoanOrmEntity)
    private readonly ormRepo: Repository<DebtLoanOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string, statusFilter: DebtLoanStatusFilter): Promise<DebtLoan[]> {
    const where: Record<string, unknown> = { userId, deletedAt: IsNull() };
    if (statusFilter === 'pending') {
      where.status = DebtLoanStatus.PENDING;
    } else if (statusFilter === 'settled') {
      where.status = DebtLoanStatus.SETTLED;
    }
    const rows = await this.ormRepo.find({
      where,
      order: { date: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<DebtLoan | null> {
    const row = await this.ormRepo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async aggregateByReference(
    userId: string,
    statusFilter: DebtLoanStatusFilter,
  ): Promise<DebtsSummaryRow[]> {
    // Same grouping shape as the legacy
    // `transactions.aggregateDebtsByReference` so the web dashboard
    // doesn't need to change its render code. Keys on
    // `(LOWER(unaccent(reference)), currency)` — Juan-in-PEN and
    // Juan-in-USD are separate rows since summing across currencies
    // would be nonsense.
    const havingClause =
      statusFilter === 'pending'
        ? `HAVING COUNT(*) FILTER (WHERE dl.status = 'PENDING') > 0`
        : statusFilter === 'settled'
          ? `HAVING COUNT(*) FILTER (WHERE dl.status = 'PENDING') = 0
             AND COUNT(*) FILTER (WHERE dl.status = 'SETTLED') > 0`
          : '';

    const rows = await this.ormRepo.manager.query<
      Array<{
        reference: string;
        currency: Currency;
        display_name: string;
        pending_debt: string;
        pending_loan: string;
        pending_count: string;
        settled_count: string;
      }>
    >(
      `
      SELECT
        LOWER(unaccent(dl.reference)) AS reference,
        dl.currency AS currency,
        (array_agg(dl.reference ORDER BY dl."createdAt" DESC))[1] AS display_name,
        COALESCE(SUM(
          CASE WHEN dl.type = 'DEBT' AND dl.status = 'PENDING'
               THEN dl."remainingAmount" ELSE 0 END
        ), 0) AS pending_debt,
        COALESCE(SUM(
          CASE WHEN dl.type = 'LOAN' AND dl.status = 'PENDING'
               THEN dl."remainingAmount" ELSE 0 END
        ), 0) AS pending_loan,
        COUNT(*) FILTER (WHERE dl.status = 'PENDING') AS pending_count,
        COUNT(*) FILTER (WHERE dl.status = 'SETTLED') AS settled_count
      FROM debts_loans dl
      WHERE dl."userId" = $1
        AND dl."deletedAt" IS NULL
      GROUP BY LOWER(unaccent(dl.reference)), dl.currency
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

  async findPendingByNormalizedReference(
    userId: string,
    reference: string,
    currency?: Currency,
  ): Promise<DebtLoan[]> {
    const qb = this.ormRepo
      .createQueryBuilder('dl')
      .where('dl.userId = :userId', { userId })
      .andWhere(`dl.status = 'PENDING'`)
      .andWhere('LOWER(unaccent(dl.reference)) = LOWER(unaccent(:reference))', { reference });

    if (currency) {
      qb.andWhere('dl.currency = :currency', { currency });
    }

    const rows = await qb.getMany();
    return rows.map((r) => this.toDomain(r));
  }

  async findPendingByReferenceCurrencyType(
    userId: string,
    reference: string,
    currency: Currency,
    type: DebtLoanType,
  ): Promise<DebtLoan[]> {
    // Oldest-first for the amount-based FIFO settle. Without an explicit
    // ORDER BY, Postgres returns heap order — nondeterministic. `createdAt`
    // then `id` are stable tiebreakers when several rows share the same
    // `date` (e.g. bulk-created same day), so the FIFO distribution is
    // reproducible run to run.
    const rows = await this.ormRepo
      .createQueryBuilder('dl')
      .where('dl.userId = :userId', { userId })
      .andWhere(`dl.status = 'PENDING'`)
      .andWhere('LOWER(unaccent(dl.reference)) = LOWER(unaccent(:reference))', { reference })
      .andWhere('dl.currency = :currency', { currency })
      .andWhere('dl.type = :type', { type })
      .orderBy('dl.date', 'ASC')
      .addOrderBy('dl.createdAt', 'ASC')
      .addOrderBy('dl.id', 'ASC')
      .getMany();
    return rows.map((r) => this.toDomain(r));
  }

  async save(debt: DebtLoan, manager?: EntityManager): Promise<DebtLoan> {
    const m = manager ?? this.ormRepo.manager;
    const saved = await m.save(DebtLoanOrmEntity, {
      id: debt.id,
      userId: debt.userId,
      type: debt.type,
      categoryId: debt.categoryId,
      currency: debt.currency,
      amount: debt.amount,
      remainingAmount: debt.remainingAmount,
      status: debt.status,
      reference: debt.reference,
      description: debt.description,
      date: debt.date,
      createdAt: debt.createdAt,
      updatedAt: debt.updatedAt,
      deletedAt: debt.deletedAt,
      sourceMonthlyServicePaymentId: debt.sourceMonthlyServicePaymentId,
    });
    return this.toDomain(saved);
  }

  async softDelete(id: string, manager?: EntityManager): Promise<void> {
    const m = manager ?? this.ormRepo.manager;
    await m.softDelete(DebtLoanOrmEntity, id);
  }

  async findBySourcePaymentIds(paymentIds: string[], manager?: EntityManager): Promise<DebtLoan[]> {
    if (paymentIds.length === 0) return [];
    const m = manager ?? this.ormRepo.manager;
    const rows = await m.find(DebtLoanOrmEntity, {
      where: { sourceMonthlyServicePaymentId: In(paymentIds), deletedAt: IsNull() },
      // The linkedDebts[] array this feeds is a frontend-consumed contract.
      // Without an explicit ORDER BY, Postgres returns heap order —
      // nondeterministic across VACUUM/updates. `id` is a stable tiebreaker
      // for split debts that share a createdAt (same-transaction generation).
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(orm: DebtLoanOrmEntity): DebtLoan {
    return new DebtLoan(
      orm.id,
      orm.userId,
      orm.type,
      orm.categoryId,
      orm.currency,
      typeof orm.amount === 'string' ? Number(orm.amount) : orm.amount,
      typeof orm.remainingAmount === 'string' ? Number(orm.remainingAmount) : orm.remainingAmount,
      orm.status,
      orm.reference,
      orm.description,
      orm.date,
      orm.createdAt,
      orm.updatedAt,
      orm.deletedAt,
      orm.sourceMonthlyServicePaymentId,
    );
  }
}
