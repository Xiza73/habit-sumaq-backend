import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
} from 'class-validator';

export class AddBudgetMovementDto {
  @ApiProperty({ example: 50.0, description: 'Monto del gasto (> 0). En la moneda del budget.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description:
      'Cuenta desde donde se debita. Su moneda debe coincidir con la del budget (CURRENCY_MISMATCH si no).',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  accountId: string;

  @ApiProperty({
    description:
      'Categoría del gasto. Requerida — se reutiliza el catálogo de categorías globales.',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    description:
      'Fecha del movimiento (ISO 8601). Debe caer dentro del mes del budget — fuera de rango el backend rechaza con MOVEMENT_DATE_OUT_OF_RANGE.',
    example: '2026-04-15T12:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  date: Date;

  @ApiPropertyOptional({
    example: 'Cena con amigos',
    description: 'Descripción opcional del movimiento.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description?: string;
}
