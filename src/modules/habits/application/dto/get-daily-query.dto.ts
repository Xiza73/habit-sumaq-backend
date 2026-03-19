import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, Matches } from 'class-validator';

export class GetDailyQueryDto {
  @ApiPropertyOptional({
    example: '2026-03-13',
    description: 'Fecha para la cual obtener el resumen (YYYY-MM-DD). Si se omite, usa la fecha actual.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;
}
