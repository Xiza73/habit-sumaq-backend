import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';
import { DebtLoanRepository } from '@modules/debts-loans/domain/debt-loan.repository';
import { DebtLoanStatus } from '@modules/debts-loans/domain/enums/debt-loan-status.enum';

import { MonthlyServicePaymentRepository } from '../../domain/monthly-service-payment.repository';

/**
 * DELETE /monthly-service-payments/:id.
 *
 * Same shape as DELETE /budget-movements/:id — soft-delete + refund
 * the pool atomically. A monthly-service payment IS the recorded
 * expense; deleting it should reverse the pool debit.
 *
 * **Linked-debt cascade (shared-service-payments slice 2)**: if this
 * payment generated `LOAN`s (via `DebtLoanSettlementComposer`), any that
 * are still `PENDING` are soft-deleted in the SAME transaction — an
 * unpaid split loses its meaning once the parent payment is reverted.
 * `SETTLED` linked debts are left untouched: they remain visible as
 * history (`GET /debts`) and their earlier pool credit is NOT reversed —
 * reverting it here would double-count against the settle's own audit
 * trail (`debt_loan_payments`), which already recorded that credit as a
 * distinct, real event.
 */
@Injectable()
export class DeleteMonthlyServicePaymentUseCase {
  constructor(
    private readonly repo: MonthlyServicePaymentRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly debtLoanRepo: DebtLoanRepository,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(DeleteMonthlyServicePaymentUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const payment = await this.repo.findById(id);
    if (!payment || payment.isDeleted()) {
      throw new DomainException('MONTHLY_SERVICE_PAYMENT_NOT_FOUND', 'Pago no encontrado');
    }
    if (payment.userId !== userId) {
      throw new DomainException(
        'MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER',
        'No tenés acceso a este pago',
      );
    }

    let cascadedCount = 0;

    await this.dataSource.transaction(async (manager) => {
      await this.repo.softDelete(id, manager);
      await this.poolService.applyDelta(userId, payment.currency, payment.amount, manager);

      const linkedDebts = await this.debtLoanRepo.findBySourcePaymentIds([id], manager);
      const unsettled = linkedDebts.filter((d) => d.status !== DebtLoanStatus.SETTLED);
      for (const debt of unsettled) {
        await this.debtLoanRepo.softDelete(debt.id, manager);
      }
      cascadedCount = unsettled.length;
    });

    this.logger.info(
      {
        event: 'monthly_service_payment.deleted',
        monthlyServicePaymentId: id,
        userId,
        monthlyServiceId: payment.monthlyServiceId,
        period: payment.period,
        currency: payment.currency,
        refundAmount: payment.amount,
        cascadedLinkedDebtsDeleted: cascadedCount,
      },
      'monthly_service_payment.deleted',
    );
  }
}
