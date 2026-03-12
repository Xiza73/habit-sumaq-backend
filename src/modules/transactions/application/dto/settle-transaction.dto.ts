import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class SettleTransactionDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Cuenta desde la que se paga (DEBT) o a la que se recibe (LOAN)',
  })
  @IsUUID()
  accountId: string;

  @ApiProperty({ example: 50.0, description: 'Monto a liquidar (≤ saldo pendiente)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({
    example: 'Pago parcial de deuda',
    description: 'Descripción personalizada. Si se omite, se genera automáticamente',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description?: string | null;

  @ApiPropertyOptional({
    example: '2026-02-01T12:00:00Z',
    description: 'Fecha de la liquidación. Si se omite, se usa la fecha actual',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;
}
