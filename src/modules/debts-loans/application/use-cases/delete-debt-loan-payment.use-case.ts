import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { DebtLoanRepository } from '../../domain/debt-loan.repository';
import { DebtLoanPaymentRepository } from '../../domain/debt-loan-payment.repository';
import { DebtLoanStatus } from '../../domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

/**
 * DELETE /debts/payments/:paymentId. Fase 2 de payment-history.
 *
 * Reglas matemáticas (invariante: `remainingAmount = amount - Σ payments.amount`):
 *
 *  - Delete revierte el pago: `remainingAmount += payment.amount`.
 *  - Si la row estaba SETTLED, se reabre a PENDING.
 *  - Currency pool reversal (solo si `payment.currency != null`):
 *    El settle original aplicó:
 *      DEBT: -payment.amount      LOAN: +payment.amount
 *    El delete revierte con el signo opuesto:
 *      DEBT: +payment.amount      LOAN: -payment.amount
 *    Mirror exacto de `settle-debt-loan.use-case.ts` en sentido inverso.
 *  - Sanity check: `remainingAmount` resultante no puede exceder
 *    `debt.amount` (overshoot lógico — solo posible si los datos ya
 *    estaban inconsistentes). Salta con `DEBT_LOAN_PAYMENT_EXCEEDS_DEBT_AMOUNT`.
 *  - Atomicidad: TODO va dentro de `dataSource.transaction()` — delete
 *    del payment + update del parent + delta del pool.
 *  - El payment row se borra de verdad (hard-delete) — no hay soft-delete
 *    para payment history.
 *
 *  - Concurrencia (lost update): las lecturas del payment y del parent, y
 *    la aritmética que depende de ellas, corren DENTRO de la tx con
 *    `pessimistic_write` en ambas. Es el caso más peligroso de los cuatro:
 *    sin el lock, dos deletes concurrentes del MISMO payment leen ambos el
 *    row como presente y cada uno devuelve `payment.amount` al pool — plata
 *    duplicada de la nada. Con el lock, el segundo re-lee después del commit
 *    del primero, no encuentra el row y corta con
 *    `DEBT_LOAN_PAYMENT_NOT_FOUND`. **Orden de lock: payment primero, debt
 *    después** — idéntico en `UpdateDebtLoanPaymentUseCase`.
 */
@Injectable()
export class DeleteDebtLoanPaymentUseCase {
  constructor(
    private readonly debtRepo: DebtLoanRepository,
    private readonly paymentRepo: DebtLoanPaymentRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(DeleteDebtLoanPaymentUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(paymentId: string, userId: string): Promise<void> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      // Locked reads, payment before debt — see the concurrency note above.
      const payment = await this.paymentRepo.findById(paymentId, manager);
      if (!payment) {
        throw new DomainException('DEBT_LOAN_PAYMENT_NOT_FOUND', 'Pago no encontrado');
      }

      const debt = await this.debtRepo.findById(payment.debtLoanId, manager);
      if (!debt || debt.isDeleted()) {
        throw new DomainException('DEBT_LOAN_NOT_FOUND', 'Deuda/préstamo no encontrado');
      }
      if (debt.userId !== userId) {
        throw new DomainException(
          'DEBT_LOAN_BELONGS_TO_OTHER_USER',
          'No tenés acceso a esta deuda/préstamo',
        );
      }

      const newRemaining = round2(debt.remainingAmount + payment.amount);
      if (newRemaining > debt.amount) {
        // Sanity: implicaría que Σ payments > debt.amount, situación que
        // no debería ser alcanzable en runtime (settle valida overpayment).
        throw new DomainException(
          'DEBT_LOAN_PAYMENT_EXCEEDS_DEBT_AMOUNT',
          'El nuevo saldo pendiente excedería el monto original de la deuda/préstamo',
        );
      }

      debt.remainingAmount = newRemaining;
      if (newRemaining > 0) {
        debt.status = DebtLoanStatus.PENDING;
      }
      debt.updatedAt = new Date();

      const isRealPayment = payment.currency !== null;

      await this.paymentRepo.deleteById(payment.id, manager);
      await this.debtRepo.save(debt, manager);

      if (isRealPayment && payment.currency !== null) {
        // Reverse del settle original: DEBT settle restó del pool → al
        // borrar el payment devolvemos esa plata al pool (+). LOAN
        // settle sumó → al borrar sacamos (-).
        const sign = debt.type === DebtLoanType.DEBT ? 1 : -1;
        const poolDelta = round2(sign * payment.amount);
        await this.poolService.applyDelta(userId, payment.currency, poolDelta, manager);
      }

      return {
        paymentId: payment.id,
        debtLoanId: payment.debtLoanId,
        isRealPayment,
        amount: payment.amount,
        remaining: debt.remainingAmount,
        status: debt.status,
      };
    });

    this.logger.info(
      {
        event: 'debt_loan.payment_deleted',
        paymentId: outcome.paymentId,
        debtLoanId: outcome.debtLoanId,
        userId,
        mode: outcome.isRealPayment ? 'real-payment' : 'informal',
        amount: outcome.amount,
        remaining: outcome.remaining,
        status: outcome.status,
      },
      'debt_loan.payment_deleted',
    );
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
