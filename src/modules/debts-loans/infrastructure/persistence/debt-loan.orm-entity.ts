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

import { DebtLoanStatus } from '../../domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

/**
 * TypeORM entity for the `debts_loans` table. Mirrors the DDL of
 * migration `1741000028000-CreateDebtsLoansTable` — column types,
 * lengths, CHECK constraints, and indexes are all expressed there
 * (TypeORM cannot fully express CHECKs we want, e.g.
 * `remainingAmount <= amount`, so we leave the schema definitions in
 * the migration as the source of truth).
 *
 * `type` / `status` / `currency` stored as `varchar + CHECK` rather
 * than postgres ENUM types — same convention as other modules.
 */
@Entity('debts_loans')
@Index('IDX_debts_loans_user_status', ['userId', 'status'])
export class DebtLoanOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 4 })
  type: DebtLoanType;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'varchar', length: 3 })
  currency: Currency;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  remainingAmount: number;

  @Column({ type: 'varchar', length: 8 })
  status: DebtLoanStatus;

  @Column({ type: 'varchar', length: 255 })
  reference: string;

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

  @Column({ type: 'uuid', nullable: true })
  sourceMonthlyServicePaymentId: string | null;
}
