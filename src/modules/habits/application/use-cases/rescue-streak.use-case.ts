import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { HabitRepository } from '../../domain/habit.repository';
import { HabitLogRepository } from '../../domain/habit-log.repository';
import { HabitStreakRescueRepository } from '../../domain/habit-streak-rescue.repository';

import { StatsCalculator } from './stats-calculator';
import { findRescuableDate } from './streak-rescue-window';

/**
 * Spends one streak shield to bridge the period the user just missed.
 *
 * Nothing about the habit's logs changes — the rescue is recorded on its own
 * table and `StatsCalculator` bridges the walk from there, so the completion
 * rate and the calendar keep telling the truth about what was actually done.
 */
@Injectable()
export class RescueStreakUseCase {
  constructor(
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
    private readonly rescueRepo: HabitStreakRescueRepository,
    private readonly settingsRepo: UserSettingsRepository,
  ) {}

  async execute(
    habitId: string,
    userId: string,
    timezone: string,
  ): Promise<{ rescuedDate: string }> {
    const habit = await this.habitRepo.findById(habitId);
    if (!habit) {
      throw new DomainException('HABIT_NOT_FOUND', 'Hábito no encontrado');
    }
    if (habit.userId !== userId) {
      throw new DomainException('HABIT_BELONGS_TO_OTHER_USER', 'Este hábito no te pertenece');
    }
    if (habit.isArchived) {
      throw new DomainException(
        'HABIT_ARCHIVED',
        'No se puede rescatar la racha de un hábito archivado',
      );
    }

    const settings = await this.settingsRepo.findByUserId(userId);
    if (!settings || settings.streakShields <= 0) {
      throw new DomainException('NO_STREAK_SHIELDS', 'No tienes escudos de racha disponibles');
    }

    const today = StatsCalculator.todayIn(settings.timezone || timezone);
    const [logs, rescuedDates] = await Promise.all([
      this.habitLogRepo.findCompletedByHabitId(habit.id),
      this.rescueRepo.findDatesByHabitId(habit.id),
    ]);

    const rescuableDate = findRescuableDate(habit.frequency, logs, rescuedDates, today);
    if (!rescuableDate) {
      throw new DomainException(
        'NO_RESCUABLE_PERIOD',
        'No hay un período para rescatar en este hábito',
      );
    }

    // Order matters, and it is not arbitrary.
    //
    // These two writes live in repositories owned by different modules, so a
    // shared transaction would mean injecting the DataSource here and reaching
    // past the repository abstractions this codebase keeps use cases behind.
    // Instead the order is chosen so the failure window favours the user: the
    // rescue lands FIRST, then the shield is spent.
    //
    // If the second write fails they keep a shield they already used — mildly
    // generous. The reverse would take a shield and give nothing back, which
    // is exactly the kind of thing that kills trust in a reward mechanic.
    //
    // The UNIQUE on (habitId, rescuedDate) means a retry after a half-failure
    // cannot double-rescue the same period.
    await this.rescueRepo.create(habit.id, userId, rescuableDate);

    settings.spendShield();
    await this.settingsRepo.save(settings);

    return { rescuedDate: rescuableDate };
  }
}
