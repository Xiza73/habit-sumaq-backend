import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TransactionStatus } from '../../domain/enums/transaction-status.enum';
import { TransactionType } from '../../domain/enums/transaction-type.enum';

import type { Transaction } from '../../domain/transaction.entity';

export class TransactionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  accountId: string;

  @ApiPropertyOptional({ nullable: true })
  categoryId: string | null;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ example: 50.0 })
  amount: number;

  @ApiPropertyOptional({ example: 'Almuerzo en restaurante', nullable: true })
  description: string | null;

  @ApiProperty()
  date: Date;

  @ApiPropertyOptional({ nullable: true })
  destinationAccountId: string | null;

  @ApiPropertyOptional({ example: 'Juan Pérez', nullable: true })
  reference: string | null;

  @ApiPropertyOptional({ enum: TransactionStatus, nullable: true })
  status: TransactionStatus | null;

  @ApiPropertyOptional({ nullable: true })
  relatedTransactionId: string | null;

  @ApiPropertyOptional({ example: 100.0, nullable: true })
  remainingAmount: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromDomain(tx: Transaction): TransactionResponseDto {
    const dto = new TransactionResponseDto();
    dto.id = tx.id;
    dto.userId = tx.userId;
    dto.accountId = tx.accountId;
    dto.categoryId = tx.categoryId;
    dto.type = tx.type;
    dto.amount = tx.amount;
    dto.description = tx.description;
    dto.date = tx.date;
    dto.destinationAccountId = tx.destinationAccountId;
    dto.reference = tx.reference;
    dto.status = tx.status;
    dto.relatedTransactionId = tx.relatedTransactionId;
    dto.remainingAmount = tx.remainingAmount;
    dto.createdAt = tx.createdAt;
    dto.updatedAt = tx.updatedAt;
    return dto;
  }
}
