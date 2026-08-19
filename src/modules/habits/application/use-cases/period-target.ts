import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

import type { Habit } from '../../domain/habit.entity';
import type { HabitLog } from '../../domain/habit-log.entity';

/**
 * The target a period is measured against.
 *
 * **DAILY** — the log's own snapshotted target. Reading it off the habit is
 * what made editing a habit rewrite history: raising the target from 3 to 4
 * turned every finished past day into "3/4". A day that has no log yet has
 * nothing snapshotted, so it falls back to the habit's current default, which
 * is also what a fresh log would be written with.
 *
 * **WEEKLY** — always the habit's target. A weekly habit's objective belongs
 * to the WEEK, and a week spans several logs; there is no single log whose
 * snapshot could speak for it. Per-week snapshots are a separate design, and
 * quietly using one log's target here would be a guess dressed up as a rule.
 *
 * Extracted because the same derivation is needed by the habits list, the
 * single-habit read and the daily summary — three copies of it drifting apart
 * is exactly how the original bug survived.
 */
export function resolvePeriodTarget(habit: Habit, periodLog: HabitLog | null | undefined): number {
  if (habit.frequency === HabitFrequency.WEEKLY) return habit.targetCount;
  return periodLog?.targetCount ?? habit.targetCount;
}
