import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * One participant's split for a shared-service payment. `reference` is
 * used AS-IS (raw, not normalized) as the `debts_loans.reference` of the
 * generated `LOAN` — normalization/grouping for display happens at the
 * SQL `unaccent` layer (`aggregateByReference`), same as any other
 * manually-created debt, so a generated LOAN groups uniformly with
 * pre-existing debts for that person.
 */
export class MonthlyServicePaymentParticipantDto {
  @ApiProperty({
    example: 'Ana',
    minLength: 1,
    maxLength: 255,
    description:
      'Nombre de la persona. Se usa tal cual (sin normalizar) como reference del LOAN generado.',
  })
  @IsString()
  @Length(1, 255)
  reference: string;

  @ApiProperty({
    example: 100.0,
    description: 'Monto que le corresponde a esta persona en ESTE pago. Debe ser > 0.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'Si true, el LOAN se crea y liquida en la misma transacción (la persona ya devolvió ' +
      'su parte). Si false/omitido, el LOAN queda PENDING.',
  })
  @IsOptional()
  @IsBoolean()
  alreadyPaid?: boolean;
}

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
 *
 * `participants` (shared-service-payments slice 2, optional): per-person
 * splits. When present and non-empty, the use case generates one `LOAN`
 * per participant linked to this payment (`sourceMonthlyServicePaymentId`)
 * inside the SAME transaction as the payment itself. `amount` still
 * DEBITS the pool by the FULL bill — the user's own share is implicit
 * (`amount - sum(participants[].amount)`) and generates no row.
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

  @ApiPropertyOptional({
    type: [MonthlyServicePaymentParticipantDto],
    description:
      'Splits para servicios compartidos. Omitir o enviar `[]` = comportamiento no compartido ' +
      '(sin cambios). `sum(participants[].amount)` no puede superar `amount`.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MonthlyServicePaymentParticipantDto)
  participants?: MonthlyServicePaymentParticipantDto[];
}
