import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

import type { CreateAccountDto } from './create-account.dto';

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Cuenta Ahorros BCP' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '#2196F3', nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateAccountDto) => o.color !== null)
  @IsString()
  @MaxLength(7)
  color?: string | null;

  @ApiPropertyOptional({ example: 'credit-card', nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateAccountDto) => o.icon !== null)
  @IsString()
  @MaxLength(50)
  icon?: string | null;
}
