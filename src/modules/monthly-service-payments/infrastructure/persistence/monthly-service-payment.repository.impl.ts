import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { type EntityManager, IsNull, Repository } from 'typeorm';

import { MonthlyServicePayment } from '../../domain/monthly-service-payment.entity';
import { MonthlyServicePaymentRepository } from '../../domain/monthly-service-payment.repository';

import { MonthlyServicePaymentOrmEntity } from './monthly-service-payment.orm-entity';

@Injectable()
export class MonthlyServicePaymentRepositoryImpl extends MonthlyServicePaymentRepository {
  constructor(
    @InjectRepository(MonthlyServicePaymentOrmEntity)
    private readonly ormRepo: Repository<MonthlyServicePaymentOrmEntity>,
  ) {
    super();
  }

  async findByServiceId(monthlyServiceId: string): Promise<MonthlyServicePayment[]> {
    const rows = await this.ormRepo.find({
      where: { monthlyServiceId, deletedAt: IsNull() },
      order: { period: 'DESC', date: 'DESC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<MonthlyServicePayment | null> {
    const row = await this.ormRepo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByServiceAndPeriod(
    monthlyServiceId: string,
    period: string,
  ): Promise<MonthlyServicePayment | null> {
    const row = await this.ormRepo.findOne({
      where: { monthlyServiceId, period, deletedAt: IsNull() },
    });
    return row ? this.toDomain(row) : null;
  }

  async dailyByCurrencyInRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ date: string; currency: string; total: number }>> {
    const rows = await this.ormRepo
      .createQueryBuilder('p')
      .select(`TO_CHAR(p.date AT TIME ZONE 'UTC', 'YYYY-MM-DD')`, 'date')
      .addSelect('p.currency', 'currency')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.userId = :userId', { userId })
      .andWhere('p.deletedAt IS NULL')
      .andWhere('p.date >= :from', { from })
      .andWhere('p.date < :to', { to })
      .groupBy(`TO_CHAR(p.date AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)
      .addGroupBy('p.currency')
      .orderBy('date', 'ASC')
      .addOrderBy('currency', 'ASC')
      .getRawMany<{ date: string; currency: string; total: string }>();
    return rows.map((r) => ({
      date: r.date,
      currency: r.currency,
      total: Number(r.total),
    }));
  }

  async sumByCurrencyInRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ currency: string; total: number }>> {
    const rows = await this.ormRepo
      .createQueryBuilder('p')
      .select('p.currency', 'currency')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.userId = :userId', { userId })
      .andWhere('p.deletedAt IS NULL')
      .andWhere('p.date >= :from', { from })
      .andWhere('p.date < :to', { to })
      .groupBy('p.currency')
      .orderBy('p.currency', 'ASC')
      .getRawMany<{ currency: string; total: string }>();
    return rows.map((r) => ({ currency: r.currency, total: Number(r.total) }));
  }

  async save(
    payment: MonthlyServicePayment,
    manager?: EntityManager,
  ): Promise<MonthlyServicePayment> {
    const m = manager ?? this.ormRepo.manager;
    const saved = await m.save(MonthlyServicePaymentOrmEntity, {
      id: payment.id,
      userId: payment.userId,
      monthlyServiceId: payment.monthlyServiceId,
      currency: payment.currency,
      amount: payment.amount,
      period: payment.period,
      description: payment.description,
      date: payment.date,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      deletedAt: payment.deletedAt,
    });
    return this.toDomain(saved);
  }

  async softDelete(id: string, manager?: EntityManager): Promise<void> {
    const m = manager ?? this.ormRepo.manager;
    await m.softDelete(MonthlyServicePaymentOrmEntity, id);
  }

  private toDomain(orm: MonthlyServicePaymentOrmEntity): MonthlyServicePayment {
    return new MonthlyServicePayment(
      orm.id,
      orm.userId,
      orm.monthlyServiceId,
      orm.currency,
      typeof orm.amount === 'string' ? Number(orm.amount) : orm.amount,
      orm.period,
      orm.description,
      orm.date,
      orm.createdAt,
      orm.updatedAt,
      orm.deletedAt,
    );
  }
}
