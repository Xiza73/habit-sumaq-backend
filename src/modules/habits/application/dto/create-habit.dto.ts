import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';

export class CreateHabitDto {
  @ApiProperty({ example: 'Tomar 8 vasos de agua' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Beber al menos 8 vasos de agua al día', nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateHabitDto) => o.description !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({ enum: HabitFrequency, example: HabitFrequency.DAILY })
  @IsEnum(HabitFrequency)
  frequency: HabitFrequency;

  @ApiPropertyOptional({ example: 8, default: 1, description: 'Cantidad objetivo por período' })
  @IsOptional()
  @IsInt()
  @Min(1)
  targetCount?: number;

  @ApiPropertyOptional({ example: '#2196F3', nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateHabitDto) => o.color !== null)
  @IsString()
  @MaxLength(7)
  color?: string | null;

  @ApiPropertyOptional({ example: 'water', nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateHabitDto) => o.icon !== null)
  @IsString()
  @MaxLength(50)
  icon?: string | null;
}
