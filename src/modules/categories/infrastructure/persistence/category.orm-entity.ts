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

import { CategoryType } from '../../domain/enums/category-type.enum';

@Entity('categories')
@Index(['userId', 'name'], { unique: true, where: '"deletedAt" IS NULL' })
export class CategoryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  user: UserOrmEntity;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: CategoryType })
  type: CategoryType;

  @Column({ type: 'varchar', length: 7, nullable: true, default: null })
  color: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  icon: string | null;

  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true, default: null })
  deletedAt: Date | null;
}
