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
 * TypeORM entity for the `budget_movements` table. Mirrors the DDL of
 * `1741000030000-CreateBudgetMovementsTable`. The migration is the
 * source of truth for CHECK constraints and indexes that TypeORM can't
 * fully model.
 *
 * `currency` uses `varchar(3) + CHECK` rather than a postgres ENUM —
 * same convention as `currency_pools` and `debts_loans`.
 */
@Entity('budget_movements')
@Index('IDX_budget_movements_user_date', ['userId', 'date'])
@Index('IDX_budget_movements_budget', ['budgetId'])
export class BudgetMovementOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  budgetId: string;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'varchar', length: 3 })
  currency: Currency;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: number;

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
