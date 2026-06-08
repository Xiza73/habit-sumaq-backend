import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';

import { DebtLoanRepository } from '../../domain/debt-loan.repository';

/**
 * DELETE /debts/:id. Soft-delete only (CLAUDE.md rule #7).
 *
 * IMPORTANT: this use case does NOT revert any prior pool deltas. A
 * SETTLED row that had real-payment(s) applied left a permanent record on
 * the currency pool — deleting the obligation row does NOT un-spend (or
 * un-receive) that money. If you need to reverse a real-payment, do so
 * BEFORE deleting (a future use case can wrap it; not needed for v1.0.0).
 */
@Injectable()
export class DeleteDebtLoanUseCase {
  constructor(
    private readonly repo: DebtLoanRepository,
    @InjectPinoLogger(DeleteDebtLoanUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
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

    await this.repo.softDelete(id);

    this.logger.info(
      {
        event: 'debt_loan.deleted',
        debtLoanId: id,
        userId,
        wasSettled: debt.isSettled(),
        unrevertedSettlement: debt.amount - debt.remainingAmount,
      },
      'debt_loan.deleted',
    );
  }
}
