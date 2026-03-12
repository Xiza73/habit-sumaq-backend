import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AccountType } from '../../domain/enums/account-type.enum';
import { Currency } from '../../domain/enums/currency.enum';

import type { Account } from '../../domain/account.entity';

export class AccountResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ example: 'Cuenta BCP' })
  name: string;

  @ApiProperty({ enum: AccountType })
  type: AccountType;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ example: 1500.0 })
  balance: number;

  @ApiPropertyOptional({ example: '#4CAF50', nullable: true })
  color: string | null;

  @ApiPropertyOptional({ example: 'wallet', nullable: true })
  icon: string | null;

  @ApiProperty({ example: false })
  isArchived: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromDomain(account: Account): AccountResponseDto {
    const dto = new AccountResponseDto();
    dto.id = account.id;
    dto.userId = account.userId;
    dto.name = account.name;
    dto.type = account.type;
    dto.currency = account.currency;
    dto.balance = account.balance;
    dto.color = account.color;
    dto.icon = account.icon;
    dto.isArchived = account.isArchived;
    dto.createdAt = account.createdAt;
    dto.updatedAt = account.updatedAt;
    return dto;
  }
}
