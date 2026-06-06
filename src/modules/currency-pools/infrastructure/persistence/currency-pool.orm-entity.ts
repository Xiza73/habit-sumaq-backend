import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Currency } from '@common/enums/currency.enum';

/**
 * `(userId, currency)` is unique — one pool per pair. The UNIQUE constraint
 * is enforced at the DB level so any race that escapes the application's
 * `pessimistic_write` lock still fails loudly with a constraint violation
 * instead of silently inserting a duplicate row.
 *
 * `currency` stored as `varchar(3) + CHECK` rather than a Postgres ENUM
 * type — same pattern as the rest of the codebase (see
 * `monthly-service.orm-entity.ts`), keeps migrations cheap when adding new
 * currencies in the future.
 *
 * `NUMERIC(14, 2)` matches the precision the existing `transactions.amount`
 * + `accounts.balance` columns use. 14 digits before the decimal point
 * (12 integer digits) is plenty for any realistic single-user balance.
 *
 * NOTE: this entity is internal-only. No controller, no DTO, never returned
 * over HTTP. Forming part of internal bookkeeping only.
 */
@Entity('currency_pools')
@Unique('UQ_currency_pools_user_currency', ['userId', 'currency'])
@Index('IDX_currency_pools_userId', ['userId'])
export class CurrencyPoolOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  // VARCHAR + CHECK at the DB level; enum here is purely TS narrowing.
  @Column({ type: 'varchar', length: 3 })
  currency: Currency;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  balance: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
