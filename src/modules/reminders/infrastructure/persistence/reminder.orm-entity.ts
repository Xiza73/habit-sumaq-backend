import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('reminders')
@Index('IDX_reminders_userId', ['userId'])
// The alerts builder asks "what is pending and dated" on every bell read, so
// the partial-shaped lookup gets its own index.
@Index('IDX_reminders_userId_completed_remindDate', ['userId', 'completed', 'remindDate'])
export class ReminderOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /**
   * `date`, not `timestamptz`: the day is the user's calendar day, and a
   * timestamp would drag it across midnight the moment they travel. Same
   * reason `habit_logs.date` and `chores.nextDueDate` are dates.
   */
  @Column({ type: 'date', nullable: true })
  remindDate: string | null;

  /** `HH:mm` wall-clock time in the user's zone. Null unless `remindDate` is set. */
  @Column({ type: 'time', nullable: true })
  remindTime: string | null;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
