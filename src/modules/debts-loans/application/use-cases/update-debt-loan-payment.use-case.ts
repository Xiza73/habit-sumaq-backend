import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { DebtLoanRepository } from '../../domain/debt-loan.repository';
import { DebtLoanPayment } from '../../domain/debt-loan-payment.entity';
import { DebtLoanPaymentRepository } from '../../domain/debt-loan-payment.repository';
import { DebtLoanStatus } from '../../domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

import type { UpdateDebtLoanPaymentDto } from '../dto/update-debt-loan-payment.dto';

/**
 * PATCH /debts/payments/:paymentId. Fase 2 de payment-history.
 *
 * Reglas matemáticas (invariante: `remainingAmount = amount - Σ payments.amount`):
 *
 *  - Edit con cambio de amount `oldAmount → newAmount`:
 *      delta = newAmount - oldAmount
 *      remainingAmount -= delta          (es decir, baja si subimos el pago)
 *      status:
 *        - remainingAmount <= 0 → SETTLED
 *        - remainingAmount  > 0 (y antes era SETTLED) → reabrir a PENDING
 *
 *  - Currency pool reversal (solo si `payment.currency != null`):
 *    El settle original aplicó al pool:
 *      DEBT: -oldAmount      LOAN: +oldAmount
 *    Para edit:
 *      DEBT: aplicar -(newAmount - oldAmount) al pool → equivale a
 *             revertir el viejo (+oldAmount) y aplicar el nuevo (-newAmount).
 *      LOAN: aplicar +(newAmount - oldAmount).
 *    Net delta al pool = signo * (newAmount - oldAmount), donde
 *    signo(DEBT) = -1, signo(LOAN) = +1. Mirror exacto de
 *    `settle-debt-loan.use-case.ts` (DEBT debita, LOAN credita).
 *
 *  - Validaciones:
 *    - Al menos un campo presente → si no, `DEBT_LOAN_PAYMENT_UPDATE_NO_FIELDS`.
 *    - newAmount no puede dejar `remainingAmount < 0` (overpayment) →
 *      `DEBT_LOAN_SETTLEMENT_EXCEEDS_REMAINING`.
 *    - newAmount no puede dejar `remainingAmount > debt.amount`
 *      (lógicamente imposible: implicaría amount negativo de pago) →
 *      `DEBT_LOAN_PAYMENT_EXCEEDS_DEBT_AMOUNT`.
 *
 *  - Currency NO es editable post-create (cambiarla flippearía
 *    pool/no-pool mode — el DTO no la expone).
 *
 *  - Atomicidad: TODO va dentro de `dataSource.transaction()` — update
 *    del payment + update del parent + delta del pool. Mismo patrón
 *    crítico que `SettleDebtLoanUseCase`.
 *
 *  - Concurrencia (lost update): las lecturas del payment y del parent, y
 *    toda la aritmética que depende de ellas, corren DENTRO de la tx con
 *    `pessimistic_write` en ambas. La cuenta es un read-modify-write sobre
 *    `debt.remainingAmount` cuyo delta mueve el pool; leyendo afuera, dos
 *    edits concurrentes parten del mismo `remainingAmount` y el segundo
 *    pisa al primero dejando el pool desalineado con el historial.
 *    **Orden de lock: payment primero, debt después** — idéntico en
 *    `DeleteDebtLoanPaymentUseCase`, para que no puedan deadlockearse.
 *    La validación de shape del DTO (no-fields) queda AFUERA: no depende
 *    del estado de la DB, así que no vale abrir tx ni tomar locks.
 */
@Injectable()
export class UpdateDebtLoanPaymentUseCase {
  constructor(
    private readonly debtRepo: DebtLoanRepository,
    private readonly paymentRepo: DebtLoanPaymentRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(UpdateDebtLoanPaymentUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    paymentId: string,
    userId: string,
    dto: UpdateDebtLoanPaymentDto,
  ): Promise<DebtLoanPayment> {
    if (dto.amount === undefined && dto.note === undefined && dto.paidAt === undefined) {
      throw new DomainException(
        'DEBT_LOAN_PAYMENT_UPDATE_NO_FIELDS',
        'Tenés que enviar al menos un campo para actualizar',
      );
    }

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

      const oldAmount = payment.amount;
      const newAmount = dto.amount ?? oldAmount;
      const amountChanged = dto.amount !== undefined && newAmount !== oldAmount;

      if (amountChanged) {
        const delta = round2(newAmount - oldAmount);
        const newRemaining = round2(debt.remainingAmount - delta);

        if (newRemaining < 0) {
          throw new DomainException(
            'DEBT_LOAN_SETTLEMENT_EXCEEDS_REMAINING',
            'El nuevo monto excede el saldo pendiente',
          );
        }
        if (newRemaining > debt.amount) {
          // Sanity: implicaría que el pago neto es negativo. Solo puede
          // pasar si los datos ya estaban inconsistentes (oldAmount >
          // debt.amount + remaining), o si el DTO bajó tanto el amount
          // que la suma total de payments quedó "negativa".
          throw new DomainException(
            'DEBT_LOAN_PAYMENT_EXCEEDS_DEBT_AMOUNT',
            'El nuevo saldo pendiente excedería el monto original de la deuda/préstamo',
          );
        }

        debt.remainingAmount = newRemaining;
        debt.status = newRemaining <= 0 ? DebtLoanStatus.SETTLED : DebtLoanStatus.PENDING;
        debt.updatedAt = new Date();
      }

      const isRealPayment = payment.currency !== null;

      payment.applyEdit({
        amount: dto.amount,
        note: dto.note,
        // Only the business date moves; `createdAt` is untouched by design.
        paidAt: dto.paidAt !== undefined ? new Date(dto.paidAt) : undefined,
      });
      const persisted = await this.paymentRepo.update(payment, manager);

      if (amountChanged) {
        await this.debtRepo.save(debt, manager);

        if (isRealPayment && payment.currency !== null) {
          // DEBT: -(newAmount - oldAmount). LOAN: +(newAmount - oldAmount).
          // Mirror del signo en settle-debt-loan.use-case.ts.
          const sign = debt.type === DebtLoanType.DEBT ? -1 : 1;
          const poolDelta = round2(sign * (newAmount - oldAmount));
          if (poolDelta !== 0) {
            await this.poolService.applyDelta(userId, payment.currency, poolDelta, manager);
          }
        }
      }

      return {
        persisted,
        isRealPayment,
        oldAmount,
        remaining: debt.remainingAmount,
        status: debt.status,
      };
    });

    const saved = outcome.persisted;

    this.logger.info(
      {
        event: 'debt_loan.payment_updated',
        paymentId: saved.id,
        debtLoanId: saved.debtLoanId,
        userId,
        mode: outcome.isRealPayment ? 'real-payment' : 'informal',
        oldAmount: outcome.oldAmount,
        newAmount: saved.amount,
        remaining: outcome.remaining,
        status: outcome.status,
      },
      'debt_loan.payment_updated',
    );

    return saved;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
