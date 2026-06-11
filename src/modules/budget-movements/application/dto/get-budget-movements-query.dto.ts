import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * GET /budget-movements?budgetId=... — filtra por budget.
 *
 * Por ahora `budgetId` es obligatorio (la UI siempre lista movements
 * dentro de un budget específico). Si en el futuro hace falta un
 * listado cross-budget, agregamos un segundo endpoint o relajamos
 * esta validación.
 */
export class GetBudgetMovementsQueryDto {
  @ApiProperty({
    description: 'ID del budget a listar.',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  budgetId: string;
}
