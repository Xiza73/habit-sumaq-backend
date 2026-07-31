import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsPositive, IsString, Length, ValidateNested } from 'class-validator';

/**
 * One row of the batch participant list. Same shape as the retired
 * `CreateMonthlyServiceParticipantDto` (reference + defaultAmount) — no
 * `id` field. Rows are matched against the CURRENT active set by
 * normalized reference, not by id (see
 * `ReplaceMonthlyServiceParticipantsUseCase`).
 */
export class ReplaceMonthlyServiceParticipantItemDto {
  @ApiProperty({
    example: 'Ana',
    minLength: 1,
    maxLength: 255,
    description:
      'Nombre/referencia de la persona. Se normaliza internamente (trim + minúsculas + sin ' +
      'acentos) para detectar duplicados dentro del mismo batch.',
  })
  @IsString()
  @Length(1, 255)
  reference: string;

  @ApiProperty({
    example: 100.0,
    description: 'Monto fijo que le corresponde a este participante cuando se paga el servicio.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  defaultAmount: number;
}

/**
 * PUT /monthly-services/:id/participants body. `participants` IS the
 * final active set — the submitted array REPLACES whatever was
 * configured before (full-list replace, not incremental add/update).
 * Empty array clears all configured participants.
 */
export class ReplaceMonthlyServiceParticipantsDto {
  @ApiProperty({
    type: [ReplaceMonthlyServiceParticipantItemDto],
    description:
      'Lista completa de participantes activos deseada. Reemplaza toda la configuración ' +
      'existente del servicio. Array vacío = sin participantes configurados.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReplaceMonthlyServiceParticipantItemDto)
  participants: ReplaceMonthlyServiceParticipantItemDto[];
}
