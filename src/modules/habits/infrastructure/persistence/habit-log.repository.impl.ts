import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { HabitLog } from '../../domain/habit-log.entity';
import { HabitLogRepository } from '../../domain/habit-log.repository';

import { HabitLogOrmEntity } from './habit-log.orm-entity';

@Injectable()
export class HabitLogRepositoryImpl extends HabitLogRepository {
  constructor(
    @InjectRepository(HabitLogOrmEntity)
    private readonly repo: Repository<HabitLogOrmEntity>,
  ) {
    super();
  }

  async findByHabitIdAndDate(habitId: string, date: string): Promise<HabitLog | null> {
    const entity = await this.repo.findOne({
      where: { habitId, date },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByHabitId(
    habitId: string,
    dateFrom?: string,
    dateTo?: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: HabitLog[]; total: number }> {
    const qb = this.repo.createQueryBuilder('log').where('log.habitId = :habitId', { habitId });

    if (dateFrom) {
      qb.andWhere('log.date >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('log.date <= :dateTo', { dateTo });
    }

    qb.orderBy('log.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [entities, total] = await qb.getManyAndCount();
    return {
      data: entities.map((e) => this.toDomain(e)),
      total,
    };
  }

  async findByUserIdAndDate(userId: string, date: string): Promise<HabitLog[]> {
    const entities = await this.repo.find({
      where: { userId, date },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findCompletedByHabitIdSince(habitId: string, since: string): Promise<HabitLog[]> {
    const entities = await this.repo
      .createQueryBuilder('log')
      .where('log.habitId = :habitId', { habitId })
      .andWhere('log.completed = true')
      .andWhere('log.date >= :since', { since })
      .orderBy('log.date', 'ASC')
      .getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async save(log: HabitLog): Promise<HabitLog> {
    const entity = this.repo.create({
      id: log.id,
      habitId: log.habitId,
      userId: log.userId,
      date: log.date,
      count: log.count,
      completed: log.completed,
      note: log.note,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDeleteByHabitId(habitId: string): Promise<void> {
    await this.repo.delete({ habitId });
  }

  private toDomain(entity: HabitLogOrmEntity): HabitLog {
    return new HabitLog(
      entity.id,
      entity.habitId,
      entity.userId,
      entity.date,
      entity.count,
      entity.completed,
      entity.note,
      entity.createdAt,
      entity.updatedAt,
    );
  }
}
