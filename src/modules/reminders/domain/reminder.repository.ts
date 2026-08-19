import { type Reminder } from './reminder.entity';

export abstract class ReminderRepository {
  /**
   * All reminders for a user. Ordered so the actionable ones come first:
   * pending before completed, then by `remindDate` ascending with undated
   * ones last, then by `createdAt`.
   */
  abstract findByUserId(userId: string): Promise<Reminder[]>;

  abstract findById(id: string): Promise<Reminder | null>;

  abstract save(reminder: Reminder): Promise<Reminder>;

  abstract deleteById(id: string): Promise<void>;
}
