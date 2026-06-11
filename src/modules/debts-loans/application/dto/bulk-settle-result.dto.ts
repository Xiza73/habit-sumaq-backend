import { ApiProperty } from '@nestjs/swagger';

import { Currency } from '@common/enums/currency.enum';

/**
 * Response shape for POST /debts/settle-by-reference. Reports what got
 * touched so the client can show "Liquidé N obligaciones por X PEN".
 */
export class BulkSettleResultDto {
  @ApiProperty({
    description: 'Cantidad de rows que se marcaron SETTLED en este bulk.',
    example: 5,
  })
  settledCount: number;

  @ApiProperty({
    description:
      'Suma total liquidada. En real-payment mode equivale al monto neto movido al pool. ' +
      'En informal-close puede ser >0 (lo que estaba pendiente) o 0 si no había nada.',
    example: 750,
  })
  totalSettledAmount: number;

  @ApiProperty({
    enum: Currency,
    nullable: true,
    description:
      'Moneda del bulk (presente si fue real-payment; null si fue informal-close ' +
      'sobre varias monedas — en ese caso ver `totalSettledAmount` como referencia mixta).',
    example: Currency.PEN,
  })
  currency: Currency | null;

  @ApiProperty({
    description: 'IDs de las rows efectivamente liquidadas.',
    type: [String],
    format: 'uuid',
  })
  settledIds: string[];
}
