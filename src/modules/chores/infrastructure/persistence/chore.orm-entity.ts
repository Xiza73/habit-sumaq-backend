import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { IntervalUnit } from '../../domain/enums/interval-unit.enum';

@Entity('chores')
@Index('IDX_chores_userId', ['userId'])
@Index('IDX_chores_userId_isActive', ['userId', 'isActive'])
@Index('IDX_chores_userId_nextDueDate', ['userId', 'nextDueDate'])
export class ChoreOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string | null;

  @Column({ type: 'integer' })
  intervalValue: number;

  // VARCHAR + CHECK at the DB level; the enum here is purely a TS hint, the
  // column does not become a Postgres ENUM type.
  @Column({ type: 'varchar', length: 8 })
  intervalUnit: IntervalUnit;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  lastDoneDate: string | null;

  @Column({ type: 'date' })
  nextDueDate: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
