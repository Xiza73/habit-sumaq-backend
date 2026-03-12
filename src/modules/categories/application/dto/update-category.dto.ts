import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Alimentación' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '#4CAF50', nullable: true })
  @IsOptional()
  @ValidateIf((o: UpdateCategoryDto) => o.color !== null)
  @IsString()
  @MaxLength(7)
  color?: string | null;

  @ApiPropertyOptional({ example: 'shopping_cart', nullable: true })
  @IsOptional()
  @ValidateIf((o: UpdateCategoryDto) => o.icon !== null)
  @IsString()
  @MaxLength(50)
  icon?: string | null;
}
