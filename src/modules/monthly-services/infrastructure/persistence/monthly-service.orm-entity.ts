import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('monthly_services')
@Index('IDX_monthly_services_userId', ['userId'])
@Index('IDX_monthly_services_userId_isActive', ['userId', 'isActive'])
export class MonthlyServiceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'uuid' })
  defaultAccountId: string;

  @Column({ type: 'uuid' })
  categoryId: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

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
  estimatedAmount: number | null;

  @Column({ type: 'int', nullable: true })
  dueDay: number | null;

  @Column({ type: 'varchar', length: 7 })
  startPeriod: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  lastPaidPeriod: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
