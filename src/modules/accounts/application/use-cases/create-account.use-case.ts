import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Account } from '../../domain/account.entity';
import { AccountRepository } from '../../domain/account.repository';

import type { CreateAccountDto } from '../dto/create-account.dto';

@Injectable()
export class CreateAccountUseCase {
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(userId: string, dto: CreateAccountDto): Promise<Account> {
    const existing = await this.accountRepo.findByUserIdAndName(userId, dto.name);
    if (existing) {
      throw new DomainException(
        'ACCOUNT_NAME_TAKEN',
        `Ya existe una cuenta con el nombre "${dto.name}"`,
      );
    }

    const account = new Account(
      randomUUID(),
      userId,
      dto.name,
      dto.type,
      dto.currency,
      dto.initialBalance ?? 0,
      dto.color ?? null,
      dto.icon ?? null,
      false,
      new Date(),
      new Date(),
      null,
    );

    return this.accountRepo.save(account);
  }
}
