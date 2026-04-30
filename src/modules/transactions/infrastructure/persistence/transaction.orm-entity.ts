import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TransactionStatus } from '../../domain/enums/transaction-status.enum';
import { TransactionType } from '../../domain/enums/transaction-type.enum';

@Entity('transactions')
@Index('IDX_transactions_userId', ['userId'])
@Index('IDX_transactions_accountId', ['accountId'])
@Index('IDX_transactions_date', ['date'])
@Index('IDX_transactions_status', ['status'])
@Index('IDX_transactions_relatedTransactionId', ['relatedTransactionId'])
@Index('IDX_transactions_monthlyServiceId', ['monthlyServiceId'])
@Index('IDX_transactions_budgetId', ['budgetId'])
export class TransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  accountId: string;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'enum', enum: TransactionType, enumName: 'transaction_type_enum' })
  type: TransactionType;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: {
      from: (v: string | null): number => (v === null ? 0 : parseFloat(v)),
      to: (v: number): number => v,
    },
  })
  amount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'timestamptz' })
  date: Date;

  @Column({ type: 'uuid', nullable: true })
  destinationAccountId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string | null;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    enumName: 'transaction_status_enum',
    nullable: true,
  })
  status: TransactionStatus | null;

  @Column({ type: 'uuid', nullable: true })
  relatedTransactionId: string | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: {
      from: (v: string | null): number | null => (v === null ? null : parseFloat(v)),
      to: (v: number | null): number | null => v,
    },
  })
  remainingAmount: number | null;

  @Column({ type: 'uuid', nullable: true })
  monthlyServiceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  budgetId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
