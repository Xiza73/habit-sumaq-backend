import { ApiProperty } from '@nestjs/swagger';

import { Currency } from '@common/enums/currency.enum';

/**
 * Aggregated row from GET /debts/summary. One row per `(normalized
 * reference, currency)`. Matches the shape of the legacy
 * `/transactions/debts-summary` so the frontend dashboard doesn't have to
 * change its render code during A3-A5.
 */
export class DebtsSummaryResponseDto {
  @ApiProperty({
    description: 'Reference normalizada (minúsculas, sin acentos). Llave de agrupación.',
    example: 'juan',
  })
  reference: string;

  @ApiProperty({
    enum: Currency,
    description: 'Moneda del grupo. Juan-PEN y Juan-USD son rows separadas.',
  })
  currency: Currency;

  @ApiProperty({
    description: 'Nombre a mostrar — el escrito más reciente entre las rows del grupo.',
    example: 'Juan',
  })
  displayName: string;

  @ApiProperty({
    description: 'Suma de remainingAmount de DEBTs pendientes (lo que le debés a esta persona).',
    example: 500,
  })
  pendingDebt: number;

  @ApiProperty({
    description: 'Suma de remainingAmount de LOANs pendientes (lo que esta persona te debe).',
    example: 300,
  })
  pendingLoan: number;

  @ApiProperty({
    description:
      'Balance neto = pendingLoan - pendingDebt. ' +
      'Positivo = la persona te debe; negativo = tú le debes.',
    example: -200,
  })
  netOwed: number;

  @ApiProperty({
    description: 'Cantidad de rows pendientes (incluye parcialmente liquidadas).',
    example: 3,
  })
  pendingCount: number;

  @ApiProperty({
    description: 'Cantidad de rows completamente liquidadas.',
    example: 7,
  })
  settledCount: number;
}
