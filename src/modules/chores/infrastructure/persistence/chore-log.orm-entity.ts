import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ChoreOrmEntity } from './chore.orm-entity';

@Entity('chore_logs')
@Index('IDX_chore_logs_choreId_doneAt', ['choreId', 'doneAt'])
export class ChoreLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  choreId: string;

  @ManyToOne(() => ChoreOrmEntity, { onDelete: 'CASCADE' })
  chore: ChoreOrmEntity;

  @Column({ type: 'date' })
  doneAt: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
