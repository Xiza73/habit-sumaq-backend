import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { Currency } from '@common/enums/currency.enum';

/**
 * TypeORM entity for the `debt_loan_payments` table. Mirrors the DDL
 * of `1741000036000-AddDebtLoanPaymentsTable` — the migration is the
 * source of truth for the FK + CHECK constraints + the index on
 * `debtLoanId`.
 *
 * Same `varchar(3) + CHECK` convention for `currency` as the parent
 * `debt_loans` table (and every other v1.0.0 module). `currency` is
 * NULLABLE here because informal-close settlements don't carry one.
 *
 * Columns use camelCase (`debtLoanId`, `createdAt`) to match the rest
 * of the module's schema — no `name:` overrides needed.
 */
@Entity('debt_loan_payments')
@Index('IDX_debt_loan_payments_debtLoanId', ['debtLoanId'])
export class DebtLoanPaymentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  debtLoanId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: Currency | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /**
   * When the money actually moved. Editable, unlike `createdAt`, which is the
   * audit record of when the row was written. Equal at creation; they diverge
   * only when the user corrects the date afterwards.
   */
  @Column({ type: 'timestamptz' })
  paidAt: Date;
}
