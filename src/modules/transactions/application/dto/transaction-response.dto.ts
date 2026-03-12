import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TransactionStatus } from '../../domain/enums/transaction-status.enum';
import { TransactionType } from '../../domain/enums/transaction-type.enum';

import type { Transaction } from '../../domain/transaction.entity';

export class TransactionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'UUID del usuario propietario' })
  userId: string;

  @ApiProperty({ description: 'UUID de la cuenta origen' })
  accountId: string;

  @ApiPropertyOptional({ description: 'UUID de la categoría asociada (opcional)', nullable: true })
  categoryId: string | null;

  @ApiProperty({
    enum: TransactionType,
    description: 'Tipo: INCOME, EXPENSE, TRANSFER, DEBT o LOAN',
  })
  type: TransactionType;

  @ApiProperty({ example: 50.0, description: 'Monto de la transacción (siempre positivo)' })
  amount: number;

  @ApiPropertyOptional({ example: 'Almuerzo en restaurante', nullable: true })
  description: string | null;

  @ApiProperty({
    description: 'Fecha de la transacción (ISO 8601)',
    example: '2026-01-15T12:00:00.000Z',
  })
  date: Date;

  @ApiPropertyOptional({
    description: 'UUID de la cuenta destino (solo TRANSFER)',
    nullable: true,
  })
  destinationAccountId: string | null;

  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Persona o entidad asociada. Requerido para DEBT/LOAN',
    nullable: true,
  })
  reference: string | null;

  @ApiPropertyOptional({
    enum: TransactionStatus,
    description: 'Estado de la deuda/préstamo: PENDING o SETTLED. null para otros tipos',
    nullable: true,
  })
  status: TransactionStatus | null;

  @ApiPropertyOptional({
    description: 'UUID de la transacción DEBT/LOAN original (solo en liquidaciones)',
    nullable: true,
  })
  relatedTransactionId: string | null;

  @ApiPropertyOptional({
    example: 100.0,
    description: 'Monto pendiente por liquidar. null para tipos que no son DEBT/LOAN',
    nullable: true,
  })
  remainingAmount: number | null;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
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
