import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsIn, IsOptional } from 'class-validator';

import { type Period, PERIOD_VALUES } from '../utils/period-range';

export class GetReportsQueryDto {
  @ApiPropertyOptional({
    description:
      'Rango temporal a agregar. Default `month`. `week` y `30d` son deslizantes; ' +
      '`month` y `3m` son calendario-alineados en la zona horaria del usuario.',
    enum: PERIOD_VALUES,
    default: 'month',
  })
  @IsOptional()
  @IsIn(PERIOD_VALUES as unknown as string[])
  period?: Period;
}
