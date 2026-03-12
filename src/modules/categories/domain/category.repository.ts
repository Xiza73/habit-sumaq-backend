import type { Category } from './category.entity';
import type { CategoryType } from './enums/category-type.enum';

export interface CreateCategoryData {
  userId: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
}

export abstract class CategoryRepository {
  abstract findByUserId(userId: string, type?: CategoryType): Promise<Category[]>;
  abstract findByUserIdAndName(userId: string, name: string): Promise<Category | null>;
  abstract findById(id: string): Promise<Category | null>;
  abstract save(category: Category): Promise<Category>;
  abstract softDelete(id: string): Promise<void>;
}
