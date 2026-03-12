import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { AccountType } from '../../domain/enums/account-type.enum';
import { Currency } from '../../domain/enums/currency.enum';

export class CreateAccountDto {
  @ApiProperty({ example: 'Cuenta BCP' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.CHECKING })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiProperty({ enum: Currency, example: Currency.PEN })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional({ example: 1500.0, default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  initialBalance?: number;

  @ApiPropertyOptional({ example: '#4CAF50', nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateAccountDto) => o.color !== null)
  @IsString()
  @MaxLength(7)
  color?: string | null;

  @ApiPropertyOptional({ example: 'wallet', nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateAccountDto) => o.icon !== null)
  @IsString()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : value))
  icon?: string | null;
}
