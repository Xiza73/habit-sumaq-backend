import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Currency } from '@common/enums/currency.enum';

/**
 * TypeORM entity for the `monthly_service_payments` table. Mirrors the
 * DDL of `1741000032000-CreateMonthlyServicePaymentsTable`. The
 * migration is the source of truth for CHECK constraints + the
 * UNIQUE-WHERE-NOT-DELETED partial index that TypeORM can't fully model.
 */
@Entity('monthly_service_payments')
@Index('IDX_msp_user_date', ['userId', 'date'])
@Index('IDX_msp_service', ['monthlyServiceId'])
export class MonthlyServicePaymentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  monthlyServiceId: string;

  @Column({ type: 'varchar', length: 3 })
  currency: Currency;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'timestamptz' })
  date: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
