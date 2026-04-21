import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class PayMonthlyServiceDto {
  @ApiProperty({ example: 42.9, description: 'Monto del pago (positivo)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    description: 'Fecha del pago en ISO-8601. Si se omite, se usa el instante actual.',
    example: '2026-04-21T12:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;

  @ApiPropertyOptional({
    description: 'Descripción de la transacción. Por defecto = nombre del servicio.',
    example: 'Netflix abril',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: 'Si se paga desde otra cuenta distinta a la default del servicio',
  })
  @IsOptional()
  @IsUUID()
  accountIdOverride?: string;
}
