import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * PATCH /monthly-service-payments/:id body.
 *
 * `monthlyServiceId`, `currency`, and `period` are IMMUTABLE
 * post-creation — to change any, delete + recreate (so both pool
 * deltas get recorded explicitly).
 *
 * If `amount` changes, the use case applies the difference
 * `(oldAmount - newAmount)` to the pool atomically with the row save.
 */
export class UpdateMonthlyServicePaymentDto {
  @ApiPropertyOptional({
    description: 'Nuevo monto. > 0.',
    example: 55,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Nueva fecha real del pago (calendar date).',
    example: '2026-06-20T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    example: 'Pagado vía Yape (corrección)',
    nullable: true,
    maxLength: 255,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(0, 255)
  description?: string | null;
}
