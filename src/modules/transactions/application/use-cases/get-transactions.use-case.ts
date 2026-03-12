import { Injectable } from '@nestjs/common';

import { TransactionRepository } from '../../domain/transaction.repository';

import type { Transaction } from '../../domain/transaction.entity';
import type { GetTransactionsQueryDto } from '../dto/get-transactions-query.dto';

@Injectable()
export class GetTransactionsUseCase {
  constructor(private readonly txRepo: TransactionRepository) {}

  async execute(userId: string, query: GetTransactionsQueryDto): Promise<Transaction[]> {
    return this.txRepo.findByUserId(userId, {
      accountId: query.accountId,
      categoryId: query.categoryId,
      type: query.type,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }
}
