import { Injectable } from '@nestjs/common';

import { TransactionRepository } from '../../domain/transaction.repository';

import type { Transaction } from '../../domain/transaction.entity';
import type { GetTransactionsQueryDto } from '../dto/get-transactions-query.dto';
import type { PaginationMeta } from '@common/dto/api-response.dto';

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

@Injectable()
export class GetTransactionsUseCase {
  constructor(private readonly txRepo: TransactionRepository) {}

  async execute(
    userId: string,
    query: GetTransactionsQueryDto,
  ): Promise<PaginatedResult<Transaction>> {
    const { page = 1, limit = 20 } = query;

    const result = await this.txRepo.findByUserId(
      userId,
      {
        accountId: query.accountId,
        categoryId: query.categoryId,
        type: query.type,
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
      { page, limit },
    );

    const items: Transaction[] = result.items;
    const total: number = result.total;

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
