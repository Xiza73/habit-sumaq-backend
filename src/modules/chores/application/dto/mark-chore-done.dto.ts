import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class MarkChoreDoneDto {
  @ApiPropertyOptional({
    description:
      'Fecha en que se hizo la tarea (YYYY-MM-DD). Si se omite, se usa el día actual en la timezone del cliente (header x-timezone).',
    example: '2026-04-15',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'doneAt debe tener formato YYYY-MM-DD' })
  doneAt?: string;

  @ApiPropertyOptional({
    description: 'Nota opcional asociada al evento (qué se hizo, productos, etc.).',
    example: 'Usé desinfectante nuevo',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
