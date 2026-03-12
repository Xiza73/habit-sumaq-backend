import { randomUUID } from 'node:crypto';

import { Category } from '../category.entity';
import { CategoryType } from '../enums/category-type.enum';

export function buildCategory(
  overrides: Partial<{
    id: string;
    userId: string;
    name: string;
    type: CategoryType;
    color: string | null;
    icon: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }> = {},
): Category {
  return new Category(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-test-id',
    overrides.name ?? 'Comida',
    overrides.type ?? CategoryType.EXPENSE,
    overrides.color !== undefined ? overrides.color : '#FF5722',
    overrides.icon !== undefined ? overrides.icon : 'restaurant',
    overrides.isDefault ?? false,
    overrides.createdAt ?? new Date('2024-01-01T00:00:00Z'),
    overrides.updatedAt ?? new Date('2024-01-01T00:00:00Z'),
    overrides.deletedAt !== undefined ? overrides.deletedAt : null,
  );
}
