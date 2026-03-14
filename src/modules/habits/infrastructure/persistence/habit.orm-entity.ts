import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserOrmEntity } from '@modules/users/infrastructure/persistence/user.orm-entity';

import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

@Entity('habits')
@Index(['userId', 'name'], { unique: true, where: '"deletedAt" IS NULL' })
export class HabitOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  user: UserOrmEntity;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  description: string | null;

  @Column({ type: 'enum', enum: HabitFrequency, enumName: 'habit_frequency_enum' })
  frequency: HabitFrequency;

  @Column({ type: 'smallint', default: 1 })
  targetCount: number;

  @Column({ type: 'varchar', length: 7, nullable: true, default: null })
  color: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  icon: string | null;

  @Column({ default: false })
  isArchived: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true, default: null })
  deletedAt: Date | null;
}
