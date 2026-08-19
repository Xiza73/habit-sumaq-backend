import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { ReminderRepository } from '../../domain/reminder.repository';

@Injectable()
export class DeleteReminderUseCase {
  constructor(private readonly reminderRepo: ReminderRepository) {}

  async execute(id: string, userId: string): Promise<void> {
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

    await this.reminderRepo.deleteById(id);
  }
}
