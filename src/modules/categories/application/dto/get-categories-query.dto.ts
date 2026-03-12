import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsOptional } from 'class-validator';

import { CategoryType } from '../../domain/enums/category-type.enum';

export class GetCategoriesQueryDto {
  @ApiPropertyOptional({ enum: CategoryType, description: 'Filtrar por tipo' })
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;
}
