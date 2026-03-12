import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { TransactionType } from '../../domain/enums/transaction-type.enum';

export class CreateTransactionDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001', nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 50.0, description: 'Monto siempre positivo' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'Almuerzo en restaurante', nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateTransactionDto) => o.description !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description?: string | null;

  @ApiProperty({ example: '2026-01-15T12:00:00Z' })
  @Type(() => Date)
  @IsDate()
  date: Date;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Solo para transferencias',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: CreateTransactionDto) => o.type === TransactionType.TRANSFER)
  @IsUUID()
  destinationAccountId?: string | null;
}
