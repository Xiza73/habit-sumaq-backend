import { ApiProperty } from '@nestjs/swagger';

import { IsNumber, IsPositive, IsString, Length } from 'class-validator';

export class CreateMonthlyServiceParticipantDto {
  @ApiProperty({
    example: 'Ana',
    minLength: 1,
    maxLength: 255,
    description:
      'Nombre/referencia de la persona. Se normaliza internamente (trim + minúsculas + sin ' +
      'acentos) para detectar duplicados dentro del mismo servicio.',
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
