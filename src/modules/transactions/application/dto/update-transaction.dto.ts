import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateTransactionDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001', nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ example: 75.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ example: 'Cena en restaurante', nullable: true })
  @IsOptional()
  @ValidateIf((o: UpdateTransactionDto) => o.description !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description?: string | null;

  @ApiPropertyOptional({ example: '2026-01-16T19:00:00Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;
}
