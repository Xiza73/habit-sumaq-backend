import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { DebtLoanRepository } from '../../domain/debt-loan.repository';

import type { DebtLoan } from '../../domain/debt-loan.entity';

@Injectable()
export class GetDebtLoanUseCase {
  constructor(private readonly repo: DebtLoanRepository) {}

  async execute(id: string, userId: string): Promise<DebtLoan> {
    const debt = await this.repo.findById(id);
    if (!debt || debt.isDeleted()) {
      throw new DomainException('DEBT_LOAN_NOT_FOUND', 'Deuda/préstamo no encontrado');
    }
    if (debt.userId !== userId) {
      throw new DomainException(
        'DEBT_LOAN_BELONGS_TO_OTHER_USER',
        'No tenés acceso a esta deuda/préstamo',
      );
    }
    return debt;
  }
}
