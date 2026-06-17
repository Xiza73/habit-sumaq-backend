import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsNumber, IsOptional, IsString, Length, Min, ValidateIf } from 'class-validator';

/**
 * PATCH /debts/payments/:paymentId body. Reglas:
 *
 *  - `currency` NO es editable post-create (cambiarla flippearía
 *    pool/no-pool mode — fuera de scope para edit).
 *  - `amount` editable: el use case recomputa `remainingAmount` y el
 *    `status` del parent `DebtLoan`, y si la row es real-payment
 *    también ajusta el delta del pool.
 *  - `note` editable: pasar `null` borra la nota existente.
 *  - Al menos UNO de `amount` o `note` debe estar presente — el use
 *    case rejecta con `DEBT_LOAN_PAYMENT_UPDATE_NO_FIELDS` si ambos
 *    son `undefined`.
 */
export class UpdateDebtLoanPaymentDto {
  @ApiPropertyOptional({
    description: 'Nuevo monto del pago. Debe ser > 0.',
    example: 75,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Nota libre. `null` para borrarla.',
    example: 'Pago parcial vía Yape',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(0, 255)
  note?: string | null;
}
