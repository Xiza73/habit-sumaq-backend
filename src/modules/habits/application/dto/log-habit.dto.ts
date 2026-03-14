import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class LogHabitDto {
  @ApiProperty({ example: '2026-03-13', description: 'Fecha del log (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 5, description: 'Cantidad realizada' })
  @IsInt()
  @Min(0)
  count: number;

  @ApiPropertyOptional({ example: 'Hoy fue un buen día', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
