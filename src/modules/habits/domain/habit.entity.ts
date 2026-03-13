import type { HabitFrequency } from './enums/habit-frequency.enum';

export class Habit {
  constructor(
    readonly id: string,
    readonly userId: string,
    public name: string,
    public description: string | null,
    public frequency: HabitFrequency,
    public targetCount: number,
    public color: string | null,
    public icon: string | null,
    public isArchived: boolean,
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  updateProfile(
    name: string,
    description: string | null | undefined,
    frequency: HabitFrequency | undefined,
    targetCount: number | undefined,
    color: string | null | undefined,
    icon: string | null | undefined,
  ): void {
    this.name = name;
    if (description !== undefined) this.description = description;
    if (frequency !== undefined) this.frequency = frequency;
    if (targetCount !== undefined) this.targetCount = targetCount;
    if (color !== undefined) this.color = color;
    if (icon !== undefined) this.icon = icon;
    this.updatedAt = new Date();
  }

  archive(): void {
    this.isArchived = true;
    this.updatedAt = new Date();
  }

  unarchive(): void {
    this.isArchived = false;
    this.updatedAt = new Date();
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
