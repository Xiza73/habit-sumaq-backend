import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { AccountRepository } from '../../domain/account.repository';

import type { Account } from '../../domain/account.entity';

@Injectable()
export class GetAccountByIdUseCase {
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(id: string, userId: string): Promise<Account> {
    const account = await this.accountRepo.findById(id);
    if (!account) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Cuenta no encontrada');
    }
    if (account.userId !== userId) {
      throw new DomainException('ACCOUNT_BELONGS_TO_OTHER_USER', 'No tienes acceso a esta cuenta');
    }
    return account;
  }
}
