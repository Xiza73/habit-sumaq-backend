import { Injectable } from '@nestjs/common';

import { Reminder } from '../../domain/reminder.entity';
import { ReminderRepository } from '../../domain/reminder.repository';

@Injectable()
export class GetRemindersUseCase {
  constructor(private readonly reminderRepo: ReminderRepository) {}

  execute(userId: string): Promise<Reminder[]> {
    return this.reminderRepo.findByUserId(userId);
  }
}
