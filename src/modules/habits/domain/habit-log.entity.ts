export class HabitLog {
  constructor(
    readonly id: string,
    readonly habitId: string,
    readonly userId: string,
    public date: Date,
    public count: number,
    public completed: boolean,
    public note: string | null,
    readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  updateCount(count: number, targetCount: number): void {
    this.count = count;
    this.completed = count >= targetCount;
    this.updatedAt = new Date();
  }

  isCompleted(): boolean {
    return this.completed;
  }
}
