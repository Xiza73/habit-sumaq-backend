import { Injectable } from '@nestjs/common';

import {
  type DebtsSummaryRow,
  type DebtsSummaryStatusFilter,
  TransactionRepository,
} from '../../domain/transaction.repository';

@Injectable()
export class GetDebtsSummaryUseCase {
  constructor(private readonly txRepo: TransactionRepository) {}

  async execute(userId: string, status: DebtsSummaryStatusFilter): Promise<DebtsSummaryRow[]> {
    return this.txRepo.aggregateDebtsByReference(userId, status);
  }
}
