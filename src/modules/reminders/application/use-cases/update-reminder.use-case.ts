import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Reminder } from '../../domain/reminder.entity';
import { ReminderRepository } from '../../domain/reminder.repository';

import type { UpdateReminderDto } from '../dto/update-reminder.dto';

@Injectable()
export class UpdateReminderUseCase {
  constructor(private readonly reminderRepo: ReminderRepository) {}

  async execute(id: string, userId: string, dto: UpdateReminderDto): Promise<Reminder> {
    const reminder = await this.reminderRepo.findById(id);
    if (!reminder) {
      throw new DomainException('REMINDER_NOT_FOUND', 'Recordatorio no encontrado');
    }
    if (reminder.userId !== userId) {
      throw new DomainException(
        'REMINDER_BELONGS_TO_OTHER_USER',
        'No tienes acceso a este recordatorio',
      );
    }

    reminder.applyUpdate(dto);
    return this.reminderRepo.save(reminder);
  }
}
