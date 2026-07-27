import { ApiProperty } from '@nestjs/swagger';

import { IsNumber, IsPositive } from 'class-validator';

export class UpdateMonthlyServiceParticipantDto {
  @ApiProperty({
    example: 120.0,
    description: 'Nuevo monto por defecto para este participante.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  defaultAmount: number;
}
