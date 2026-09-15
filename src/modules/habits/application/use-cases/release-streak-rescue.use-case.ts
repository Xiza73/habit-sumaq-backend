import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { HabitRepository } from '../../domain/habit.repository';
import { HabitStreakRescueRepository } from '../../domain/habit-streak-rescue.repository';

import { rescuedDateCovering } from './streak-rescue-window';

/**
 * Releases a rescue and hands the shield back.
 *
 * A rescued period is bridged, not completed — the user can still go and log
 * the day for real. Until now that quietly burned the shield: the rescue had
 * no way to be undone, so it stayed on a period that no longer needed it.
 *
 * This is the escape hatch. Release the rescue, take the shield back, and the
 * day is an ordinary un-logged day again, free to be logged.
 */
@Injectable()
export class ReleaseStreakRescueUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly rescueRepo: HabitStreakRescueRepository,
    private readonly settingsRepo: UserSettingsRepository,
  ) {}

  async execute(
    habitId: string,
    userId: string,
    date: string,
  ): Promise<{ releasedDate: string; shieldReturned: boolean }> {
    const habit = await this.habitRepo.findById(habitId);
    if (!habit) {
      throw new DomainException('HABIT_NOT_FOUND', 'Hábito no encontrado');
    }
    if (habit.userId !== userId) {
      throw new DomainException('HABIT_BELONGS_TO_OTHER_USER', 'Este hábito no te pertenece');
    }

    const rescuedDates = await this.rescueRepo.findDatesByHabitId(habit.id);

    // The caller passes whatever day they were looking at. For a WEEKLY habit
    // the stored row is keyed by the Monday, so deleting by the raw input
    // would miss on six days out of seven and report "no rescue" for a period
    // that plainly has one.
    const storedDate = rescuedDateCovering(habit.frequency, date, rescuedDates);
    if (!storedDate) {
      throw new DomainException(
        'NO_RESCUE_FOR_PERIOD',
        'Ese período no está cubierto por un escudo',
      );
    }

    // No settings row means the user never had a shield to spend, so a rescue
    // without one is a state the app cannot produce. Release it anyway and say
    // plainly that nothing came back — inventing an error code for a corrupt
    // row would leave the user stuck on a day they cannot log.
    const settings = await this.settingsRepo.findByUserId(userId);
    if (!settings) {
      await this.rescueRepo.deleteByHabitIdAndDate(habit.id, storedDate);
      return { releasedDate: storedDate, shieldReturned: false };
    }

    // Mirror of `RescueStreakUseCase`, and the order is inverted for the same
    // reason it is fixed there: the two writes live in repositories owned by
    // different modules, so there is no shared transaction, and the order is
    // chosen so a half-failure favours the user.
    //
    // Refund FIRST. If the delete then fails they hold a shield AND the rescue
    // — generous. Deleting first would drop the protection and, on a failed
    // refund, give nothing back: a user who paid a shield ends up with neither
    // it nor the rescue, which is the one outcome worth engineering against.
    const shieldReturned = settings.refundShield();
    await this.settingsRepo.save(settings);

    await this.rescueRepo.deleteByHabitIdAndDate(habit.id, storedDate);

    return { releasedDate: storedDate, shieldReturned };
  }
}
