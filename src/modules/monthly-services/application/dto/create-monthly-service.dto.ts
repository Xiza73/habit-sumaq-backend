import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * Allowed billing cadences. Stored as raw integers in the DB (the column is
 * INTEGER with a CHECK constraint) so we don't need a Postgres enum type.
 */
export const ALLOWED_FREQUENCY_MONTHS = [1, 3, 6, 12] as const;

export class CreateMonthlyServiceDto {
  @ApiProperty({ example: 'Netflix', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ description: 'Cuenta desde la que se paga por defecto' })
  @IsUUID()
  defaultAccountId: string;

  @ApiProperty({ description: 'Categoría asignada a los pagos de este servicio' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    description: 'Código ISO de moneda (debe coincidir con la cuenta por defecto)',
    example: 'PEN',
    minLength: 3,
    maxLength: 3,
  })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiPropertyOptional({
    description:
      'Cadencia de cobro en meses. Permitidos: 1 (mensual), 3 (trimestral), ' +
      '6 (semestral), 12 (anual). Default: 1. Inmutable después de la creación.',
    enum: ALLOWED_FREQUENCY_MONTHS,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @IsIn(ALLOWED_FREQUENCY_MONTHS as readonly number[] as number[], {
    message: 'frequencyMonths debe ser uno de: 1, 3, 6, 12',
  })
  frequencyMonths?: number;

  @ApiPropertyOptional({
    description: 'Estimado mensual. Se recalcula al pagar (AVG de las últimas 3 tx).',
    example: 45.0,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  estimatedAmount?: number | null;

  @ApiPropertyOptional({
    description: 'Día del mes en el que vence el pago (1-31). Informativo para UI.',
    example: 15,
    minimum: 1,
    maximum: 31,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number | null;

  @ApiPropertyOptional({
    description:
      'Primer período (YYYY-MM) desde el cual el servicio empieza a pagarse. ' +
      'Si no se provee, se usa el mes actual en la zona horaria del cliente (header x-timezone).',
    example: '2026-03',
    pattern: '^\\d{4}-\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'startPeriod debe tener formato YYYY-MM' })
  startPeriod?: string;
}
