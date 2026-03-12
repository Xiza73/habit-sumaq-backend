import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Category } from '../../domain/category.entity';
import { CategoryType } from '../../domain/enums/category-type.enum';

export class CategoryResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'user-uuid' })
  userId: string;

  @ApiProperty({ example: 'Comida' })
  name: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  type: CategoryType;

  @ApiPropertyOptional({ example: '#FF5722', nullable: true })
  color: string | null;

  @ApiPropertyOptional({ example: 'restaurant', nullable: true })
  icon: string | null;

  @ApiProperty({ example: false })
  isDefault: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromDomain(category: Category): CategoryResponseDto {
    const dto = new CategoryResponseDto();
    dto.id = category.id;
    dto.userId = category.userId;
    dto.name = category.name;
    dto.type = category.type;
    dto.color = category.color;
    dto.icon = category.icon;
    dto.isDefault = category.isDefault;
    dto.createdAt = category.createdAt;
    dto.updatedAt = category.updatedAt;
    return dto;
  }
}
