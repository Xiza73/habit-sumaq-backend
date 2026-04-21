import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SkipMonthDto {
  @ApiPropertyOptional({
    description:
      'Motivo opcional del salto (e.g. "mes gratis"). No se persiste — es metadato para el log.',
    example: 'Promoción primer mes gratis',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
