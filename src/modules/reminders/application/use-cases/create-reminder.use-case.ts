import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { Reminder } from '../../domain/reminder.entity';
import { ReminderRepository } from '../../domain/reminder.repository';

import type { CreateReminderDto } from '../dto/create-reminder.dto';

@Injectable()
export class CreateReminderUseCase {
  constructor(private readonly reminderRepo: ReminderRepository) {}

  execute(userId: string, dto: CreateReminderDto): Promise<Reminder> {
    const now = new Date();
    // The entity validates the date/time combination, so an invalid pairing
    // never reaches the repository.
    const reminder = new Reminder(
      randomUUID(),
      userId,
      dto.title,
      dto.notes ?? null,
      dto.remindDate ?? null,
      dto.remindTime ?? null,
      false,
      null,
      now,
      now,
    );
    return this.reminderRepo.save(reminder);
  }
}
