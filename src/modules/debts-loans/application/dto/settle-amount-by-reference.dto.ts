import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, Length, Min } from 'class-validator';

import { Currency } from '@common/enums/currency.enum';

import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

/**
 * POST /debts/settle-amount-by-reference body — the "Mochila" settle.
 *
 * Liquida un MONTO elegido repartido, oldest-first (FIFO), sobre las rows
 * PENDING de UNA persona, en UNA sola dirección (`type`) y UNA sola
 * moneda (`currency`). El monto se consume desde la deuda más vieja hacia
 * la más nueva; la última tocada puede quedar parcialmente liquidada.
 *
 * **Real-vs-informal**: a diferencia de `/debts/:id/settle` y
 * `/debts/settle-by-reference` — donde la PRESENCIA de `currency` togglea
 * el modo — acá `currency` es OBLIGATORIA porque identifica el grupo
 * `(reference, currency)` a liquidar. El toggle de modo pasa entonces por
 * el flag explícito `realPayment`:
 *
 *  - `realPayment: true` → real-payment: mueve el pool de esa moneda
 *    (DEBT debita, LOAN credita), atómico con los writes de las rows.
 *  - `realPayment` omitido / `false` → cierre informal: marca las rows
 *    sin tocar el pool (mismo default conservador que el resto del módulo:
 *    no se mueve dinero salvo que se lo pida explícitamente).
 */
export class SettleAmountByReferenceDto {
  @ApiProperty({
    description: 'Referencia (la persona) a liquidar. Match case + accent insensitive.',
    example: 'Juan',
    maxLength: 255,
  })
  @IsNotEmpty()
  @Length(1, 255)
  reference: string;

  @ApiProperty({
    enum: Currency,
    description: 'Moneda del grupo `(reference, currency)` a liquidar. Obligatoria.',
    example: Currency.PEN,
  })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({
    enum: DebtLoanType,
    description:
      'Dirección a liquidar. `DEBT` = lo que el usuario debe; `LOAN` = lo que le deben. ' +
      'El settle aplica a UNA sola dirección.',
    example: DebtLoanType.DEBT,
  })
  @IsEnum(DebtLoanType)
  type: DebtLoanType;

  @ApiProperty({
    description:
      'Monto total a repartir FIFO sobre las rows pendientes. Debe ser > 0. ' +
      'Si excede la suma de saldos pendientes, se liquida todo sin error (el excedente se ignora).',
    example: 170,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({
    description:
      '`true` → real-payment (mueve el pool de `currency`). ' +
      'Omitido / `false` → cierre informal (no toca el pool).',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  realPayment?: boolean;
}
