import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sections')
@Index('IDX_sections_userId_position', ['userId', 'position'])
export class SectionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ type: 'integer', default: 1 })
  position: number;

  @Column({ type: 'boolean', default: false })
  isCollapsed: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
