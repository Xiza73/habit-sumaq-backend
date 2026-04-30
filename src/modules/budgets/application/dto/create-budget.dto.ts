import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

import { Currency } from '@modules/accounts/domain/enums/currency.enum';

export class CreateBudgetDto {
  @ApiPropertyOptional({
    description:
      'Año del budget (4 dígitos). Si se omite, se usa el año actual en la timezone del cliente (header x-timezone).',
    example: 2026,
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    description:
      'Mes del budget (1-12). Si se omite, se usa el mes actual en la timezone del cliente.',
    example: 4,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiProperty({ enum: Currency, description: 'Moneda del budget. Inmutable después de crear.' })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ example: 2000, description: 'Monto total presupuestado para el mes (> 0).' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
}
