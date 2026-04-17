import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { Currency } from '@modules/accounts/domain/enums/currency.enum';

export class SettleByReferenceDto {
  @ApiProperty({
    example: 'Juan',
    description:
      'Referencia a liquidar. Normalizada server-side (case + accent insensitive) — "Juán", "Juan", "JUAN" son la misma persona.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reference: string;

  @ApiPropertyOptional({
    description:
      'Limita la liquidación a transacciones en esta moneda (vía account.currency). ' +
      'Si se omite, liquida en todas las monedas (comportamiento legacy).',
    enum: Currency,
    example: Currency.PEN,
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}
