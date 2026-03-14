import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserOrmEntity } from '@modules/users/infrastructure/persistence/user.orm-entity';

import { HabitOrmEntity } from './habit.orm-entity';

@Entity('habit_logs')
@Index(['habitId', 'date'], { unique: true })
@Index('IDX_habit_logs_userId_date', ['userId', 'date'])
export class HabitLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  habitId: string;

  @ManyToOne(() => HabitOrmEntity, { onDelete: 'CASCADE' })
  habit: HabitOrmEntity;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  user: UserOrmEntity;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'smallint', default: 0 })
  count: number;

  @Column({ default: false })
  completed: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
