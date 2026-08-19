import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BudgetMovementResponseDto } from '@modules/budget-movements/application/dto/budget-movement-response.dto';

import type { Budget } from '../../domain/budget.entity';
// Imported rather than re-declared: this file used to carry a hand-mirrored
// copy of the snapshot shape, which silently drifted the moment the use-case
// grew a field.
import type { BudgetKpiSnapshot as KpiSnapshot } from '../use-cases/compute-budget-kpi';
import type { BudgetMovement } from '@modules/budget-movements/domain/budget-movement.entity';

/**
 * Full Budget shape with KPI snapshot and embedded movements. Used by:
 *  - `GET /budgets/current?currency=X` → render the dashboard for the active month.
 *  - `GET /budgets/:id` → review a historical or future budget.
 *
 * Movements are sorted by date DESC (recency-first feel).
 */
export class BudgetWithKpiResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'UUID del usuario propietario' })
  userId: string;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 4 })
  month: number;

  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({ example: 2000, description: 'Monto total presupuestado' })
  amount: number;

  @ApiProperty({
    example: 450,
    description: 'Suma de los movimientos del budget (no de todos los expenses del mes).',
  })
  spent: number;

  @ApiProperty({ example: 1550, description: 'amount - spent' })
  remaining: number;

  @ApiProperty({
    example: 16,
    description:
      'Días restantes en el mes incluyendo hoy (calculado en la timezone del cliente). 0 si el budget pertenece a un mes ya pasado.',
  })
  daysRemainingIncludingToday: number;

  @ApiPropertyOptional({
    example: 96.88,
    description:
      'Asignación diaria sugerida = remaining / daysRemainingIncludingToday. Puede ser negativa si el usuario se pasó del budget. null cuando daysRemainingIncludingToday = 0.',
    nullable: true,
  })
  dailyAllowance: number | null;

  @ApiPropertyOptional({
    example: 100,
    description:
      'Asignación diaria con la que arrancó el mes = amount / díasDelMes. Es la barra que apunta a recuperar `recovery`. null cuando daysRemainingIncludingToday = 0.',
    nullable: true,
  })
  initialDailyAllowance: number | null;

  @ApiPropertyOptional({
    description:
      'Cuántos días de contención hacen falta para que dailyAllowance vuelva a initialDailyAllowance. ' +
      '`zeroSpendDays` = días gastando 0; `halfSpendDays` = días gastando la mitad del diario inicial, ' +
      'que es exactamente el doble. `recoverable: false` cuando ni gastando 0 el resto del mes se llega — ' +
      'mostrar "no recuperable este mes" en vez de un número que el usuario no puede accionar. ' +
      'null cuando el mes ya cerró.',
    example: { zeroSpendDays: 6, halfSpendDays: 12, recoverable: true },
    nullable: true,
  })
  recovery: { zeroSpendDays: number; halfSpendDays: number; recoverable: boolean } | null;

  @ApiProperty({
    example: '2026-04-15',
    description:
      "Fecha 'hoy' usada para el cálculo (YYYY-MM-DD en la timezone del cliente). Para budgets de meses pasados/futuros, refleja la posición del cursor relativo al mes.",
  })
  currentDate: string;

  @ApiProperty({
    type: [BudgetMovementResponseDto],
    description: 'Movimientos del budget, ordenados por fecha DESC.',
  })
  movements: BudgetMovementResponseDto[];

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  updatedAt: Date;

  static fromDomain(
    budget: Budget,
    movements: BudgetMovement[],
    kpi: KpiSnapshot,
  ): BudgetWithKpiResponseDto {
    const dto = new BudgetWithKpiResponseDto();
    dto.id = budget.id;
    dto.userId = budget.userId;
    dto.year = budget.year;
    dto.month = budget.month;
    dto.currency = budget.currency;
    dto.amount = budget.amount;
    dto.spent = kpi.spent;
    dto.remaining = kpi.remaining;
    dto.daysRemainingIncludingToday = kpi.daysRemainingIncludingToday;
    dto.dailyAllowance = kpi.dailyAllowance;
    dto.initialDailyAllowance = kpi.initialDailyAllowance;
    dto.recovery = kpi.recovery;
    dto.currentDate = kpi.currentDate;
    dto.movements = movements.map((m) => BudgetMovementResponseDto.fromDomain(m));
    dto.createdAt = budget.createdAt;
    dto.updatedAt = budget.updatedAt;
    return dto;
  }
}
