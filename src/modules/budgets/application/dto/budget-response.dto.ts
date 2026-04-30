import { ApiProperty } from '@nestjs/swagger';

import type { Budget } from '../../domain/budget.entity';

/**
 * Lightweight Budget shape — no KPI, no movements. Used for list endpoints
 * (history) where the client doesn't need the full dashboard view.
 */
export class BudgetResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'UUID del usuario propietario' })
  userId: string;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 4, description: 'Mes 1-12' })
  month: number;

  @ApiProperty({ example: 'PEN', description: 'Moneda (ISO 4217)' })
  currency: string;

  @ApiProperty({ example: 2000, description: 'Monto total presupuestado' })
  amount: number;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  updatedAt: Date;

  static fromDomain(budget: Budget): BudgetResponseDto {
    const dto = new BudgetResponseDto();
    dto.id = budget.id;
    dto.userId = budget.userId;
    dto.year = budget.year;
    dto.month = budget.month;
    dto.currency = budget.currency;
    dto.amount = budget.amount;
    dto.createdAt = budget.createdAt;
    dto.updatedAt = budget.updatedAt;
    return dto;
  }
}
