import { Injectable } from '@nestjs/common';

import { DebtLoanRepository, type DebtLoanStatusFilter } from '../../domain/debt-loan.repository';

import type { DebtLoan } from '../../domain/debt-loan.entity';

@Injectable()
export class ListDebtsLoansUseCase {
  constructor(private readonly repo: DebtLoanRepository) {}

  async execute(userId: string, status: DebtLoanStatusFilter = 'pending'): Promise<DebtLoan[]> {
    return this.repo.findByUserId(userId, status);
  }
}
