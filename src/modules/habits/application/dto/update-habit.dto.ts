import { ApiPropertyOptional } from '@nestjs/swagger';

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

export class UpdateHabitDto {
  @ApiPropertyOptional({ example: 'Tomar agua' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Beber suficiente agua cada día', nullable: true })
  @IsOptional()
  @ValidateIf((o: UpdateHabitDto) => o.description !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ enum: HabitFrequency, example: HabitFrequency.DAILY })
  @IsOptional()
  @IsEnum(HabitFrequency)
  frequency?: HabitFrequency;

  @ApiPropertyOptional({ example: 8, description: 'Cantidad objetivo por período' })
  @IsOptional()
  @IsInt()
  @Min(1)
  targetCount?: number;

  @ApiPropertyOptional({ example: '#4CAF50', nullable: true })
  @IsOptional()
  @ValidateIf((o: UpdateHabitDto) => o.color !== null)
  @IsString()
  @MaxLength(7)
  color?: string | null;

  @ApiPropertyOptional({ example: 'fitness', nullable: true })
  @IsOptional()
  @ValidateIf((o: UpdateHabitDto) => o.icon !== null)
  @IsString()
  @MaxLength(50)
  icon?: string | null;
}
