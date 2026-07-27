import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TypeORM entity for `monthly_service_participants`. Mirrors the DDL of
 * migration `1741000037000-CreateMonthlyServiceParticipantsTable` — the
 * FK, CHECK constraint, and partial unique index are expressed there
 * (TypeORM decorators can't express a `WHERE` clause on a unique index),
 * so the migration remains the source of truth for those.
 */
@Entity('monthly_service_participants')
@Index('IDX_msp_service', ['monthlyServiceId'])
export class MonthlyServiceParticipantOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  monthlyServiceId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  reference: string;

  @Column({ type: 'varchar', length: 255 })
  normalizedReference: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  defaultAmount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
