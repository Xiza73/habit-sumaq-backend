import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * PATCH /debts/:id body. `type`, `currency`, `status`, and
 * `remainingAmount` are immutable — there is no use case that legitimately
 * changes them post-creation. To migrate a debt to a loan or vice-versa,
 * delete + recreate; same for changing the currency.
 *
 * If `status = SETTLED`, the use case enforces that ONLY `amount` may be
 * edited (and only ≥ already-settled portion) — other fields are rejected
 * with `CANNOT_UPDATE_SETTLED_DEBT_LOAN`.
 */
export class UpdateDebtLoanDto {
  @ApiPropertyOptional({
    description: 'Nuevo monto total. Debe ser ≥ a lo ya liquidado.',
    example: 600,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    example: 'Préstamo refinanciado',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(0, 255)
  description?: string | null;

  @ApiPropertyOptional({ example: '2026-06-08T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Cambiar la categoría asociada. Pasar `null` para des-vincular.',
    example: 'a3b1c2d4-e5f6-7890-abcd-ef1234567890',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    description: 'Renombrar la persona referenciada. Útil para corregir typos.',
    example: 'Juan Pérez',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  reference?: string;
}
