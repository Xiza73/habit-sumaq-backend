import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserOrmEntity } from '@modules/users/infrastructure/persistence/user.orm-entity';

import { HabitOrmEntity } from './habit.orm-entity';

/**
 * See `HabitStreakRescue` for why rescues are their own table rather than
 * synthetic `habit_logs` rows.
 *
 * No `updatedAt` and no soft delete: a rescue is an immutable fact. Undoing
 * one would mean refunding a shield and re-breaking a streak the user already
 * saw restored — if that is ever wanted it deserves its own decision, not a
 * `deletedAt` column sitting here inviting it.
 */
@Entity('habit_streak_rescues')
@Index(['habitId', 'rescuedDate'], { unique: true })
export class HabitStreakRescueOrmEntity {
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

  /** `YYYY-MM-DD`. For a WEEKLY habit, the Monday of the rescued week. */
  @Column({ type: 'date' })
  rescuedDate: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
