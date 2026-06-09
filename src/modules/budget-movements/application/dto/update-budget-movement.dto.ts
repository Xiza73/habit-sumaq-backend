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
 * PATCH /budget-movements/:id body.
 *
 * `budgetId` and `currency` are IMMUTABLE post-creation — to move a
 * movement to a different budget or currency, delete + recreate (so
 * both pool deltas get recorded explicitly).
 *
 * If `amount` or `date` changes, the use case re-validates against the
 * budget's `(year, month)` window and applies the pool delta difference
 * atomically.
 */
export class UpdateBudgetMovementDto {
  @ApiPropertyOptional({
    description: 'Nuevo monto. Debe ser > 0.',
    example: 80,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Nueva fecha. Debe seguir cayendo dentro del budget.',
    example: '2026-06-12T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    example: 'Cena con amigos (actualizado)',
    nullable: true,
    maxLength: 255,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(0, 255)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Pasar `null` para des-vincular la categoría.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;
}
