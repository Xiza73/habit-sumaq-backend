import { Injectable } from '@nestjs/common';

import { AccountRepository } from '../../domain/account.repository';

import type { Account } from '../../domain/account.entity';

@Injectable()
export class GetAccountsUseCase {
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(userId: string, includeArchived = false): Promise<Account[]> {
    return this.accountRepo.findByUserId(userId, includeArchived);
  }
}
