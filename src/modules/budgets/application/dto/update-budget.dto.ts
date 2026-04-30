import { ApiProperty } from '@nestjs/swagger';

import { IsNumber, Min } from 'class-validator';

export class UpdateBudgetDto {
  @ApiProperty({
    example: 2500,
    description:
      'Nuevo monto total. Único campo editable — year/month/currency son inmutables (cambiarlos rompería los movimientos linkeados).',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
}
