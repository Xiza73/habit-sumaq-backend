import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';

/**
 * POST /monthly-service-payments body.
 *
 * `currency` is NOT in the DTO — it's inherited from the
 * `monthly_services` row that `monthlyServiceId` points to. This
 * matches the budget-movements pattern: services own their currency,
 * payments inherit it.
 *
 * `period` is mandatory and must be `YYYY-MM`. Unlike the legacy where
 * the period was implicit (the calendar month of the payment), the new
 * module lets you back-pay or pay-ahead by specifying the period
 * explicitly.
 */
export class CreateMonthlyServicePaymentDto {
  @ApiProperty({
    description: 'ID del monthly service que se está pagando.',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  monthlyServiceId: string;

  @ApiProperty({
    description: 'Período al que aplica el pago. Formato `YYYY-MM`.',
    example: '2026-06',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'invalid_period_format' })
  period: string;

  @ApiProperty({
    description: 'Monto del pago. Debe ser > 0.',
    example: 50,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({
    description:
      'Fecha real en que se hizo el pago (calendar date). Default: ahora. ' +
      'NOTA: la fecha NO determina el período — `period` es independiente.',
    example: '2026-06-15T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    example: 'Pagado vía Yape',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}
