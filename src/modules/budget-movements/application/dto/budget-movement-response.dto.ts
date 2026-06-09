import { ApiProperty } from '@nestjs/swagger';

import { Currency } from '@common/enums/currency.enum';

import type { BudgetMovement } from '../../domain/budget-movement.entity';

/**
 * Response DTO. Never expose the domain or ORM entity directly
 * (CLAUDE.md rule #4). Both detail and list endpoints map via
 * `fromDomain` before responding.
 */
export class BudgetMovementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  budgetId: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ example: 75.5 })
  amount: number;

  @ApiProperty({ example: 'Cena con amigos', nullable: true })
  description: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  categoryId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  date: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  static fromDomain(m: BudgetMovement): BudgetMovementResponseDto {
    const dto = new BudgetMovementResponseDto();
    dto.id = m.id;
    dto.userId = m.userId;
    dto.budgetId = m.budgetId;
    dto.currency = m.currency;
    dto.amount = m.amount;
    dto.description = m.description;
    dto.categoryId = m.categoryId;
    dto.date = m.date;
    dto.createdAt = m.createdAt;
    dto.updatedAt = m.updatedAt;
    return dto;
  }
}
