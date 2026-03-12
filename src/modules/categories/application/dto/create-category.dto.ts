import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

import { CategoryType } from '../../domain/enums/category-type.enum';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Comida' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiPropertyOptional({ example: '#FF5722', nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateCategoryDto) => o.color !== null)
  @IsString()
  @MaxLength(7)
  color?: string | null;

  @ApiPropertyOptional({ example: 'restaurant', nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateCategoryDto) => o.icon !== null)
  @IsString()
  @MaxLength(50)
  icon?: string | null;
}
