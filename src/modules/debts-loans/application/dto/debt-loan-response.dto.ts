import { ApiProperty } from '@nestjs/swagger';

import { Currency } from '@common/enums/currency.enum';

import { DebtLoanStatus } from '../../domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

import type { DebtLoan } from '../../domain/debt-loan.entity';

/**
 * Single-row response DTO. Never expose the domain or ORM entity directly
 * (rule #4 in CLAUDE.md). All list and detail endpoints map through
 * `fromDomain` before responding.
 */
export class DebtLoanResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ enum: DebtLoanType })
  type: DebtLoanType;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ example: 500 })
  amount: number;

  @ApiProperty({ example: 320 })
  remainingAmount: number;

  @ApiProperty({ enum: DebtLoanStatus })
  status: DebtLoanStatus;

  @ApiProperty({ example: 'Juan' })
  reference: string;

  @ApiProperty({ example: 'Préstamo para emergencia', nullable: true })
  description: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  categoryId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  date: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  static fromDomain(debt: DebtLoan): DebtLoanResponseDto {
    const dto = new DebtLoanResponseDto();
    dto.id = debt.id;
    dto.userId = debt.userId;
    dto.type = debt.type;
    dto.currency = debt.currency;
    dto.amount = debt.amount;
    dto.remainingAmount = debt.remainingAmount;
    dto.status = debt.status;
    dto.reference = debt.reference;
    dto.description = debt.description;
    dto.categoryId = debt.categoryId;
    dto.date = debt.date;
    dto.createdAt = debt.createdAt;
    dto.updatedAt = debt.updatedAt;
    return dto;
  }
}
