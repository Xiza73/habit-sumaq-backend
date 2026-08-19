import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Reminder } from '../../domain/reminder.entity';
import { ReminderRepository } from '../../domain/reminder.repository';

import { ReminderOrmEntity } from './reminder.orm-entity';

@Injectable()
export class ReminderRepositoryImpl extends ReminderRepository {
  constructor(
    @InjectRepository(ReminderOrmEntity)
    private readonly ormRepo: Repository<ReminderOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string): Promise<Reminder[]> {
    const rows = await this.ormRepo
      .createQueryBuilder('r')
      .where('r."userId" = :userId', { userId })
      // Actionable first, then soonest. `NULLS LAST` is explicit rather than
      // relying on Postgres' default (which is NULLS LAST for ASC but FIRST
      // for DESC) — undated reminders belong at the bottom, not the top.
      .orderBy('r."completed"', 'ASC')
      .addOrderBy('r."remindDate"', 'ASC', 'NULLS LAST')
      .addOrderBy('r."remindTime"', 'ASC', 'NULLS FIRST')
      .addOrderBy('r."createdAt"', 'ASC')
      .getMany();
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Reminder | null> {
    const row = await this.ormRepo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async save(reminder: Reminder): Promise<Reminder> {
    const saved = await this.ormRepo.save({
      id: reminder.id,
      userId: reminder.userId,
      title: reminder.title,
      notes: reminder.notes,
      remindDate: reminder.remindDate,
      remindTime: reminder.remindTime,
      completed: reminder.completed,
      completedAt: reminder.completedAt,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
    });
    return this.toDomain(saved);
  }

  async deleteById(id: string): Promise<void> {
    await this.ormRepo.delete(id);
  }

  private toDomain(row: ReminderOrmEntity): Reminder {
    return new Reminder(
      row.id,
      row.userId,
      row.title,
      row.notes,
      row.remindDate,
      // Postgres `time` comes back as `HH:mm:ss`; the domain speaks `HH:mm`.
      row.remindTime === null ? null : row.remindTime.slice(0, 5),
      row.completed,
      row.completedAt,
      row.createdAt,
      row.updatedAt,
    );
  }
}
