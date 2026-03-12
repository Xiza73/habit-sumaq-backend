import type { CategoryType } from './enums/category-type.enum';

export class Category {
  constructor(
    readonly id: string,
    readonly userId: string,
    public name: string,
    public type: CategoryType,
    public color: string | null,
    public icon: string | null,
    public isDefault: boolean,
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  updateProfile(
    name: string,
    color: string | null | undefined,
    icon: string | null | undefined,
  ): void {
    this.name = name;
    if (color !== undefined) this.color = color;
    if (icon !== undefined) this.icon = icon;
    this.updatedAt = new Date();
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
