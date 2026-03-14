import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Habit } from '../../domain/habit.entity';
import { HabitRepository } from '../../domain/habit.repository';

import { HabitOrmEntity } from './habit.orm-entity';

@Injectable()
export class HabitRepositoryImpl extends HabitRepository {
  constructor(
    @InjectRepository(HabitOrmEntity)
    private readonly repo: Repository<HabitOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string, includeArchived = false): Promise<Habit[]> {
    const qb = this.repo.createQueryBuilder('habit').where('habit.userId = :userId', { userId });

    if (!includeArchived) {
      qb.andWhere('habit.isArchived = false');
    }

    qb.orderBy('habit.createdAt', 'ASC');

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async findByUserIdAndName(userId: string, name: string): Promise<Habit | null> {
    const entity = await this.repo.findOne({ where: { userId, name } });
    return entity ? this.toDomain(entity) : null;
  }

  async findById(id: string): Promise<Habit | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(habit: Habit): Promise<Habit> {
    const entity = this.repo.create({
      id: habit.id,
      userId: habit.userId,
      name: habit.name,
      description: habit.description,
      frequency: habit.frequency,
      targetCount: habit.targetCount,
      color: habit.color,
      icon: habit.icon,
      isArchived: habit.isArchived,
      createdAt: habit.createdAt,
      updatedAt: habit.updatedAt,
      deletedAt: habit.deletedAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  private toDomain(entity: HabitOrmEntity): Habit {
    return new Habit(
      entity.id,
      entity.userId,
      entity.name,
      entity.description,
      entity.frequency,
      entity.targetCount,
      entity.color,
      entity.icon,
      entity.isArchived,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
