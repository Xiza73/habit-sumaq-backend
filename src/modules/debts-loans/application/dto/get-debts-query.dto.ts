import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsIn, IsOptional } from 'class-validator';

import type { DebtLoanStatusFilter } from '../../domain/debt-loan.repository';

/**
 * GET /debts y GET /debts/summary aceptan el mismo query param `status`.
 * Default: `pending` (vista principal del dashboard).
 */
export class GetDebtsQueryDto {
  @ApiPropertyOptional({
    enum: ['pending', 'settled', 'all'],
    default: 'pending',
    description:
      'Filtro por estado. `pending` = solo rows con remainingAmount > 0. ' +
      '`settled` = solo rows completamente liquidadas. `all` = sin filtro.',
  })
  @IsOptional()
  @IsIn(['pending', 'settled', 'all'])
  status?: DebtLoanStatusFilter;
}
