import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

import { Currency } from '@common/enums/currency.enum';

/**
 * POST /debts/settle-by-reference body. Liquida en una sola operación
 * TODAS las deudas/préstamos pendientes con una misma `reference` (case +
 * accent insensitive) y, opcionalmente, una misma `currency`.
 *
 * **Uso típico**: "Juan me terminó de pagar todo lo que me debía" — el
 * usuario quiere cerrar 5 LOAN sueltas en lugar de liquidarlas una por
 * una.
 *
 * **Real-payment mode** (`currency` provided): cada liquidación aplica
 * su delta al pool de esa moneda. Las rows en otras monedas NO se tocan.
 *
 * **Informal-close mode** (`currency` omitted): liquida TODAS las rows
 * pendientes con esa reference, en TODAS las monedas, sin tocar pool.
 */
export class BulkSettleByReferenceDto {
  @ApiProperty({
    description: 'Referencia a liquidar. Normalizada (case+accent insensitive).',
    example: 'Juan',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  reference: string;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Si se provee, solo liquida rows de esa moneda y aplica delta al pool. ' +
      'Si se omite, cierre informal sobre TODAS las rows pendientes de la reference.',
    example: Currency.PEN,
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}
