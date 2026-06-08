import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

import { Currency } from '@common/enums/currency.enum';

/**
 * POST /debts/:id/settle body.
 *
 * **Real-payment mode** (`currency` provided): the use case applies the
 * delta to the user's currency pool (DEBT debits the pool, LOAN credits
 * it), within the same transaction as the row update. The `currency` value
 * MUST match the debt's currency — mismatches reject with the appropriate
 * domain error. Why ask for it at all then? Two reasons: (1) makes the
 * mode explicit at the API surface (a server-side default would silently
 * record a pool movement the client didn't intend), and (2) it's the
 * client's confirmation that the obligation's currency is the one they
 * actually paid in.
 *
 * **Informal-close mode** (`currency` omitted): the use case marks the
 * debt SETTLED without touching the pool. Use case: "squared up
 * face-to-face, no need to record cash flow".
 */
export class SettleDebtLoanDto {
  @ApiProperty({
    description: 'Monto a liquidar. Debe ser > 0 y ≤ remainingAmount.',
    example: 100,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  settledAmount: number;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Moneda en la que se realiza el pago real. ' +
      'Presente → real-payment (mueve el pool). ' +
      'Omitido → cierre informal (no mueve el pool).',
    example: Currency.PEN,
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}
