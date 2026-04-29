import { type IntervalUnit } from './enums/interval-unit.enum';
import { addInterval } from './utils/add-interval';

/**
 * A recurring household task (NOT a daily habit) — e.g. "rotate tires every
 * 6 months", "wash sheets every 2 weeks", "vacuum every 3 days".
 *
 * Cadence is `(intervalValue, intervalUnit)`. `nextDueDate` is persisted (not
 * recomputed) because the user can override it manually via PATCH and the
 * "mark done" flow shifts it from the actual completion date — so it can't
 * always be derived from `lastDoneDate + interval`.
 *
 * Helpers below keep the date arithmetic out of the use cases.
 */
export class Chore {
  constructor(
    readonly id: string,
    readonly userId: string,
    public name: string,
    public notes: string | null,
    public category: string | null,
    public intervalValue: number,
    public intervalUnit: IntervalUnit,
    readonly startDate: string,
    public lastDoneDate: string | null,
    public nextDueDate: string,
    public isActive: boolean,
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  /**
   * True when `nextDueDate` is strictly earlier than the user's "today" in
   * their timezone — the frontend uses this to highlight overdue chores.
   * Both inputs are `YYYY-MM-DD` strings, lexicographic compare = date compare.
   */
  isOverdueFor(currentDate: string): boolean {
    return this.nextDueDate < currentDate;
  }

  /**
   * Marks the chore as done on `doneAt` and shifts `nextDueDate` to
   * `doneAt + interval` (rule A — the cadence resets from the actual
   * completion date, not the previous nextDueDate).
   */
  markDone(doneAt: string): void {
    this.lastDoneDate = doneAt;
    this.nextDueDate = addInterval(doneAt, this.intervalValue, this.intervalUnit);
    this.updatedAt = new Date();
  }

  /**
   * Skips one cycle — pushes `nextDueDate` forward by one interval without
   * touching `lastDoneDate`. Used when the user wants to "not now" without
   * lying about having done it.
   */
  skipCycle(): void {
    this.nextDueDate = addInterval(this.nextDueDate, this.intervalValue, this.intervalUnit);
    this.updatedAt = new Date();
  }

  toggleActive(): void {
    this.isActive = !this.isActive;
    this.updatedAt = new Date();
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
