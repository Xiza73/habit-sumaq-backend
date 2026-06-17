import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { type EntityManager, Repository } from 'typeorm';

import { DebtLoanPayment } from '../../domain/debt-loan-payment.entity';
import { DebtLoanPaymentRepository } from '../../domain/debt-loan-payment.repository';

import { DebtLoanPaymentOrmEntity } from './debt-loan-payment.orm-entity';

@Injectable()
export class DebtLoanPaymentRepositoryImpl extends DebtLoanPaymentRepository {
  constructor(
    @InjectRepository(DebtLoanPaymentOrmEntity)
    private readonly ormRepo: Repository<DebtLoanPaymentOrmEntity>,
  ) {
    super();
  }

  async create(payment: DebtLoanPayment, manager?: EntityManager): Promise<DebtLoanPayment> {
    const m = manager ?? this.ormRepo.manager;
    const saved = await m.save(DebtLoanPaymentOrmEntity, {
      id: payment.id,
      debtLoanId: payment.debtLoanId,
      amount: payment.amount,
      currency: payment.currency,
      note: payment.note,
      createdAt: payment.createdAt,
    });
    return this.toDomain(saved);
  }

  async findByDebtLoanId(debtLoanId: string): Promise<DebtLoanPayment[]> {
    const rows = await this.ormRepo.find({
      where: { debtLoanId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(orm: DebtLoanPaymentOrmEntity): DebtLoanPayment {
    return new DebtLoanPayment(
      orm.id,
      orm.debtLoanId,
      typeof orm.amount === 'string' ? Number(orm.amount) : orm.amount,
      orm.currency,
      orm.note,
      orm.createdAt,
    );
  }
}
