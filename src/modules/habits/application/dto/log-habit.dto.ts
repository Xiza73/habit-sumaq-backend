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

  @ApiPropertyOptional({
    example: 4,
    description:
      'Objetivo para ESTE día. Omitido usa el `targetCount` del hábito. ' +
      'Permite que un día puntual pida más o menos sin tocar el default ' +
      'ni reescribir los días ya registrados. Solo aplica a hábitos DAILY: ' +
      'en los WEEKLY el objetivo es de la semana, no del día.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  targetCount?: number;

  @ApiPropertyOptional({ example: 'Hoy fue un buen día', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
