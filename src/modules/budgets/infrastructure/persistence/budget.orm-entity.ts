import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('budgets')
@Index('IDX_budgets_userId', ['userId'])
@Index('IDX_budgets_userId_year_month', ['userId', 'year', 'month'])
export class BudgetOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
