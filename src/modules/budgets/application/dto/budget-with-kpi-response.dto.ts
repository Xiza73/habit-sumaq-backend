import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TransactionResponseDto } from '@modules/transactions/application/dto/transaction-response.dto';

import type { Budget } from '../../domain/budget.entity';
import type { Transaction } from '@modules/transactions/domain/transaction.entity';

interface KpiSnapshot {
  spent: number;
  remaining: number;
  daysRemainingIncludingToday: number;
  dailyAllowance: number | null;
  currentDate: string; // YYYY-MM-DD in user timezone
}

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

  @ApiProperty({
    example: '2026-04-15',
    description:
      "Fecha 'hoy' usada para el cálculo (YYYY-MM-DD en la timezone del cliente). Para budgets de meses pasados/futuros, refleja la posición del cursor relativo al mes.",
  })
  currentDate: string;

  @ApiProperty({
    type: [TransactionResponseDto],
    description: 'Movimientos del budget, ordenados por fecha DESC.',
  })
  movements: TransactionResponseDto[];

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  updatedAt: Date;

  static fromDomain(
    budget: Budget,
    movements: Transaction[],
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
    dto.currentDate = kpi.currentDate;
    dto.movements = movements.map((tx) => TransactionResponseDto.fromDomain(tx));
    dto.createdAt = budget.createdAt;
    dto.updatedAt = budget.updatedAt;
    return dto;
  }
}
