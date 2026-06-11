import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

/**
 * POST /budget-movements body.
 *
 * The new module does NOT take `accountId` — money flow lives in the
 * internal `currency_pools` table, and the currency is inherited from
 * the budget at use-case validation time. The client picks the budget;
 * the budget picks the currency.
 */
export class CreateBudgetMovementDto {
  @ApiProperty({
    description: 'ID del budget contra el que se imputa el gasto.',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  budgetId: string;

  @ApiProperty({
    description: 'Monto del movimiento. Debe ser > 0.',
    example: 75.5,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({
    description:
      'Fecha del movimiento en ISO 8601. Debe caer dentro del mes ' + 'del budget. Default: ahora.',
    example: '2026-06-08T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    example: 'Cena con amigos',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;

  @ApiPropertyOptional({
    description: 'Categoría opcional (compartida con otros módulos).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
