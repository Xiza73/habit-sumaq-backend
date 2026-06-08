import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

import { Currency } from '@common/enums/currency.enum';

import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

export class CreateDebtLoanDto {
  @ApiProperty({ enum: DebtLoanType, example: DebtLoanType.DEBT })
  @IsEnum(DebtLoanType)
  type: DebtLoanType;

  @ApiProperty({ enum: Currency, example: Currency.PEN })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({
    description: 'Monto total de la obligación. Mayor a 0.',
    example: 500,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'A quién le debes o quién te debe. Obligatorio en DEBT/LOAN.',
    example: 'Juan',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  reference: string;

  @ApiPropertyOptional({ example: 'Préstamo para emergencia médica' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;

  @ApiPropertyOptional({
    description: 'Fecha de la obligación en ISO 8601. Default: ahora.',
    example: '2026-06-08T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'ID opcional de categoría (compartida con otros módulos).',
    example: 'a3b1c2d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
