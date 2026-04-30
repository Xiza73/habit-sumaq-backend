import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

export class UpdateSectionDto {
  @ApiPropertyOptional({ example: 'Trabajo', maxLength: 60 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({
    example: '#FF6B35',
    description: 'Color hex (#RRGGBB) o `null` para quitarlo.',
    nullable: true,
  })
  // Allow `null` explicitly to clear the color. ValidateIf skips Matches when
  // the value is null but still runs IsString for non-null values.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a #RRGGBB hex string' })
  color?: string | null;
}
