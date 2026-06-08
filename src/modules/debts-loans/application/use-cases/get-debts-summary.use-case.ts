import { Injectable } from '@nestjs/common';

import {
  DebtLoanRepository,
  type DebtLoanStatusFilter,
  type DebtsSummaryRow,
} from '../../domain/debt-loan.repository';

@Injectable()
export class GetDebtsSummaryUseCase {
  constructor(private readonly repo: DebtLoanRepository) {}

  async execute(
    userId: string,
    status: DebtLoanStatusFilter = 'pending',
  ): Promise<DebtsSummaryRow[]> {
    return this.repo.aggregateByReference(userId, status);
  }
}
