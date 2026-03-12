import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AccountType } from '../../domain/enums/account-type.enum';
import { Currency } from '../../domain/enums/currency.enum';

@Entity('accounts')
@Index('IDX_accounts_userId', ['userId'])
export class AccountOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: AccountType, enumName: 'account_type_enum' })
  type: AccountType;

  @Column({ type: 'enum', enum: Currency, enumName: 'currency_enum' })
  currency: Currency;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: '0.00',
    transformer: {
      from: (v: string | null): number => (v === null ? 0 : parseFloat(v)),
      to: (v: number): number => v,
    },
  })
  balance: number;

  @Column({ nullable: true, type: 'varchar', length: 7 })
  color: string | null;

  @Column({ nullable: true, type: 'varchar', length: 50 })
  icon: string | null;

  @Column({ default: false })
  isArchived: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
