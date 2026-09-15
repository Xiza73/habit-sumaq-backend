import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';

import { HabitStreakRescue } from '../../domain/habit-streak-rescue.entity';
import { HabitStreakRescueRepository } from '../../domain/habit-streak-rescue.repository';

import { HabitStreakRescueOrmEntity } from './habit-streak-rescue.orm-entity';

@Injectable()
export class HabitStreakRescueRepositoryImpl extends HabitStreakRescueRepository {
  constructor(
    @InjectRepository(HabitStreakRescueOrmEntity)
    private readonly ormRepo: Repository<HabitStreakRescueOrmEntity>,
  ) {
    super();
  }

  async findDatesByHabitId(habitId: string): Promise<string[]> {
    const rows = await this.ormRepo.find({
      where: { habitId },
      select: { rescuedDate: true },
    });
    return rows.map((row) => row.rescuedDate);
  }

  async findDatesByHabitIds(habitIds: string[]): Promise<Map<string, string[]>> {
    const byHabit = new Map<string, string[]>();
    // `In([])` generates `IN ()`, which Postgres rejects — and the list view
    // legitimately renders zero habits for a new user.
    if (habitIds.length === 0) return byHabit;

    const rows = await this.ormRepo.find({
      where: { habitId: In(habitIds) },
      select: { habitId: true, rescuedDate: true },
    });

    for (const row of rows) {
      const dates = byHabit.get(row.habitId);
      if (dates) dates.push(row.rescuedDate);
      else byHabit.set(row.habitId, [row.rescuedDate]);
    }
    return byHabit;
  }

  async deleteByHabitIdAndDate(habitId: string, rescuedDate: string): Promise<boolean> {
    const result = await this.ormRepo.delete({ habitId, rescuedDate });
    // `affected` is driver-reported and typed `number | null | undefined`;
    // treating a null as "deleted" would refund a shield for nothing.
    return (result.affected ?? 0) > 0;
  }

  async create(habitId: string, userId: string, rescuedDate: string): Promise<HabitStreakRescue> {
    const saved = await this.ormRepo.save(this.ormRepo.create({ habitId, userId, rescuedDate }));
    return new HabitStreakRescue(
      saved.id,
      saved.habitId,
      saved.userId,
      saved.rescuedDate,
      saved.createdAt,
    );
  }
}
