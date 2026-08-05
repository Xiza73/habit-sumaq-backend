import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Currency } from '@common/enums/currency.enum';

import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

/**
 * Response shape for POST /debts/settle-amount-by-reference. Reports how
 * the FIFO distribution landed so the client can render
 * "Liquidé N obligaciones (M completas) por X PEN".
 */
export class SettleAmountByReferenceResultDto {
  @ApiProperty({
    description: 'Cantidad de rows tocadas (liquidadas total o parcialmente) en este settle.',
    example: 3,
  })
  settledCount: number;

  @ApiProperty({
    description:
      'Monto total efectivamente liquidado. Igual al `amount` pedido, salvo que este ' +
      'exceda la suma de saldos pendientes — en cuyo caso equivale a esa suma (cap).',
    example: 170,
  })
  totalSettledAmount: number;

  @ApiProperty({
    description: 'Cuántas de las rows tocadas quedaron completamente liquidadas (SETTLED).',
    example: 2,
  })
  fullySettledCount: number;

  @ApiPropertyOptional({
    description:
      'Id de la última row liquidada parcialmente (sigue PENDING con saldo restante), ' +
      'o `null` si el monto cerró todas las rows tocadas sin dejar parciales.',
    format: 'uuid',
    nullable: true,
    example: '00000000-0000-4000-9000-000000000010',
  })
  partiallySettledId: string | null;

  @ApiProperty({
    enum: Currency,
    description: 'Moneda del grupo liquidado.',
    example: Currency.PEN,
  })
  currency: Currency;

  @ApiProperty({
    enum: DebtLoanType,
    description: 'Dirección liquidada (`DEBT` o `LOAN`).',
    example: DebtLoanType.DEBT,
  })
  type: DebtLoanType;
}
