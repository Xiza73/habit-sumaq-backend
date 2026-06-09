import { ApiProperty } from '@nestjs/swagger';

import { Currency } from '@common/enums/currency.enum';

import type { MonthlyServicePayment } from '../../domain/monthly-service-payment.entity';

/**
 * Response DTO. Never expose the domain or ORM entity directly
 * (CLAUDE.md rule #4). Maps via `fromDomain` before responding.
 */
export class MonthlyServicePaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  monthlyServiceId: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ example: 50 })
  amount: number;

  @ApiProperty({ example: '2026-06' })
  period: string;

  @ApiProperty({ example: 'Pagado vía Yape', nullable: true })
  description: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  date: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  static fromDomain(p: MonthlyServicePayment): MonthlyServicePaymentResponseDto {
    const dto = new MonthlyServicePaymentResponseDto();
    dto.id = p.id;
    dto.userId = p.userId;
    dto.monthlyServiceId = p.monthlyServiceId;
    dto.currency = p.currency;
    dto.amount = p.amount;
    dto.period = p.period;
    dto.description = p.description;
    dto.date = p.date;
    dto.createdAt = p.createdAt;
    dto.updatedAt = p.updatedAt;
    return dto;
  }
}
