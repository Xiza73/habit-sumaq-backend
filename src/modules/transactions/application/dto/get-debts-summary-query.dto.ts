import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsOptional } from 'class-validator';

export enum DebtsSummaryStatusFilter {
  PENDING = 'pending',
  ALL = 'all',
  SETTLED = 'settled',
}

export class GetDebtsSummaryQueryDto {
  @ApiPropertyOptional({
    description:
      'Filtro por estado de las transacciones incluidas en el resumen. ' +
      '`pending` (default) devuelve solo referencias con al menos una transacción pendiente. ' +
      '`all` incluye todas las referencias con algún DEBT/LOAN. ' +
      '`settled` devuelve referencias cuyas DEBT/LOAN están completamente liquidadas.',
    enum: DebtsSummaryStatusFilter,
    default: DebtsSummaryStatusFilter.PENDING,
  })
  @IsOptional()
  @IsEnum(DebtsSummaryStatusFilter)
  status: DebtsSummaryStatusFilter = DebtsSummaryStatusFilter.PENDING;
}
