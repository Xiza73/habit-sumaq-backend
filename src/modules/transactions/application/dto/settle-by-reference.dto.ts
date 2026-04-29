import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Modo "pago real": cuenta donde se contabiliza el flujo. Por cada deuda/préstamo ' +
      'pendiente se crea una transacción de liquidación (EXPENSE para DEBT, INCOME para LOAN) ' +
      'que mueve plata. Si se omite, la liquidación es "informal" — solo marca como SETTLED sin ' +
      'tocar cuentas. Al usar `accountId`, `currency` es obligatorio para asegurar coincidencia.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
