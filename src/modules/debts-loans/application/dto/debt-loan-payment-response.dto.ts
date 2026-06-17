import { ApiProperty } from '@nestjs/swagger';

import { Currency } from '@common/enums/currency.enum';

import type { DebtLoanPayment } from '../../domain/debt-loan-payment.entity';

/**
 * Response DTO for a single row of the debt-loan payment history.
 * Never expose the domain or ORM entity directly (CLAUDE.md rule #4).
 */
export class DebtLoanPaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 50 })
  amount: number;

  @ApiProperty({ enum: Currency, nullable: true })
  currency: Currency | null;

  @ApiProperty({ example: null, nullable: true })
  note: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  static fromDomain(p: DebtLoanPayment): DebtLoanPaymentResponseDto {
    const dto = new DebtLoanPaymentResponseDto();
    dto.id = p.id;
    dto.amount = p.amount;
    dto.currency = p.currency;
    dto.note = p.note;
    dto.createdAt = p.createdAt;
    return dto;
  }
}
