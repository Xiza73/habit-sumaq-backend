import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { DebtLoanRepository } from '../../domain/debt-loan.repository';
import { DebtLoanPaymentRepository } from '../../domain/debt-loan-payment.repository';

import type { DebtLoanPayment } from '../../domain/debt-loan-payment.entity';

/**
 * GET /debts/:id/payments. Lista el historial de settles aplicados a
 * un `DebtLoan`, más reciente primero.
 *
 * Valida la existencia + ownership del parent ANTES de leer los
 * payments — copia del guard en `GetDebtLoanUseCase` para no exponer
 * el child cuando el parent no es accesible para el usuario.
 */
@Injectable()
export class ListDebtLoanPaymentsUseCase {
  constructor(
    private readonly debtRepo: DebtLoanRepository,
    private readonly paymentRepo: DebtLoanPaymentRepository,
  ) {}

  async execute(debtLoanId: string, userId: string): Promise<DebtLoanPayment[]> {
    const debt = await this.debtRepo.findById(debtLoanId);
    if (!debt || debt.isDeleted()) {
      throw new DomainException('DEBT_LOAN_NOT_FOUND', 'Deuda/préstamo no encontrado');
    }
    if (debt.userId !== userId) {
      throw new DomainException(
        'DEBT_LOAN_BELONGS_TO_OTHER_USER',
        'No tenés acceso a esta deuda/préstamo',
      );
    }
    return this.paymentRepo.findByDebtLoanId(debtLoanId);
  }
}
