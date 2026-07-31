import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsArray,
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
  ValidateNested,
} from 'class-validator';

/**
 * Allowed billing cadences. Stored as raw integers in the DB (the column is
 * INTEGER with a CHECK constraint) so we don't need a Postgres enum type.
 */
export const ALLOWED_FREQUENCY_MONTHS = [1, 3, 6, 12] as const;

/**
 * One participant row for the optional create-time batch. Same shape as
 * `ReplaceMonthlyServiceParticipantItemDto` — kept as a separate class
 * (rather than importing across DTO files) so each DTO owns its own
 * Swagger schema name, matching the existing per-DTO nested-class pattern
 * in this codebase (e.g. `MonthlyServicePaymentParticipantDto`).
 */
export class CreateMonthlyServiceParticipantItemDto {
  @ApiProperty({
    example: 'Ana',
    minLength: 1,
    maxLength: 255,
    description:
      'Nombre/referencia de la persona. Se normaliza internamente (trim + minúsculas + sin ' +
      'acentos) para detectar duplicados dentro del mismo batch.',
  })
  @IsString()
  @Length(1, 255)
  reference: string;

  @ApiProperty({
    example: 100.0,
    description: 'Monto fijo que le corresponde a este participante cuando se paga el servicio.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  defaultAmount: number;
}

export class CreateMonthlyServiceDto {
  @ApiProperty({ example: 'Netflix', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name: string;

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
    description: 'Estimado mensual. Se actualiza al pagar (= monto del último pago).',
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

  @ApiPropertyOptional({
    type: [CreateMonthlyServiceParticipantItemDto],
    description:
      'Configuración inicial de participantes (servicio compartido). Opcional — omitir o ' +
      'enviar `[]` crea el servicio sin cambios de comportamiento. Cuando se envía, el servicio ' +
      'y sus participantes se crean atómicamente en una sola transacción.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMonthlyServiceParticipantItemDto)
  participants?: CreateMonthlyServiceParticipantItemDto[];
}
