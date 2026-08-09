import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { DebtLoan } from '../../domain/debt-loan.entity';
import { DebtLoanRepository } from '../../domain/debt-loan.repository';
import { DebtLoanPayment } from '../../domain/debt-loan-payment.entity';
import { DebtLoanPaymentRepository } from '../../domain/debt-loan-payment.repository';
import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

import type { SettleDebtLoanDto } from '../dto/settle-debt-loan.dto';

/**
 * POST /debts/:id/settle. Dos modos:
 *
 *  - **Real-payment** (`dto.currency` presente): el pago real mueve el
 *    pool. DEBT settle = el user paga (delta NEGATIVO en su pool de esa
 *    currency). LOAN settle = el user cobra (delta POSITIVO).
 *    El currency del DTO DEBE coincidir con el currency de la deuda;
 *    mismatches lanzan `CURRENCY_MISMATCH`.
 *
 *  - **Informal-close** (`dto.currency` omitido): solo marca el row
 *    SETTLED. No toca pool.
 *
 * Atomicidad: TODOS los settles (informal o real-payment) corren dentro
 * de `dataSource.transaction()` porque siempre se inserta un row en
 * `debt_loan_payments` además del UPDATE de `remainingAmount`. Si el
 * insert falla, el settle se rollbackea (crítico para money: nunca
 * dejamos la parent row con un settle aplicado pero sin su row de
 * historial).
 *
 * **Concurrencia (lost update)**: la lectura del row Y TODOS los guards
 * corren DENTRO de la transacción, con `findById(id, manager)` tomando
 * `pessimistic_write` (`SELECT ... FOR UPDATE`). El settle es un
 * read-modify-write sobre `remainingAmount` cuyo resultado mueve el pool: si
 * la lectura pasa fuera de la tx, dos settles concurrentes sobre la misma
 * deuda leen el mismo `remainingAmount`, ambos pasan el guard de
 * `SETTLEMENT_EXCEEDS_REMAINING`, y el pool termina con el doble del delta.
 * El guard sólo vale si se evalúa contra el row lockeado — por eso ninguna
 * validación que dependa del estado de la DB queda afuera. Mismo patrón que
 * `SettleAmountByReferenceUseCase`.
 */
@Injectable()
export class SettleDebtLoanUseCase {
  constructor(
    private readonly repo: DebtLoanRepository,
    private readonly paymentRepo: DebtLoanPaymentRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(SettleDebtLoanUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string, dto: SettleDebtLoanDto): Promise<DebtLoan> {
    const isRealPayment = dto.currency !== undefined;

    const saved = await this.dataSource.transaction(async (manager) => {
      // Locked read — see the concurrency note in the class docblock. Every
      // guard below runs against THIS row, held for the life of the tx.
      const debt = await this.repo.findById(id, manager);
      if (!debt || debt.isDeleted()) {
        throw new DomainException('DEBT_LOAN_NOT_FOUND', 'Deuda/préstamo no encontrado');
      }
      if (debt.userId !== userId) {
        throw new DomainException(
          'DEBT_LOAN_BELONGS_TO_OTHER_USER',
          'No tenés acceso a esta deuda/préstamo',
        );
      }
      if (debt.isSettled()) {
        throw new DomainException(
          'DEBT_LOAN_ALREADY_SETTLED',
          'La deuda/préstamo ya fue liquidada completamente',
        );
      }
      if (dto.settledAmount > debt.remainingAmount) {
        throw new DomainException(
          'DEBT_LOAN_SETTLEMENT_EXCEEDS_REMAINING',
          'El monto excede el saldo pendiente',
        );
      }
      if (dto.currency !== undefined && dto.currency !== debt.currency) {
        throw new DomainException(
          'CURRENCY_MISMATCH',
          `La moneda del pago (${dto.currency}) no coincide con la de la obligación (${debt.currency})`,
        );
      }

      const paymentCurrency = isRealPayment ? debt.currency : null;

      debt.applySettlement(dto.settledAmount);
      const persisted = await this.repo.save(debt, manager);

      // Historial Fase 1: una row por evento de settle. `note` siempre
      // null hasta Fase 2 (edit/delete).
      await this.paymentRepo.create(
        new DebtLoanPayment(
          randomUUID(),
          persisted.id,
          dto.settledAmount,
          paymentCurrency,
          null,
          new Date(),
        ),
        manager,
      );

      if (isRealPayment) {
        // DEBT settle = pay = debit; LOAN settle = collect = credit.
        const delta = debt.type === DebtLoanType.DEBT ? -dto.settledAmount : dto.settledAmount;
        await this.poolService.applyDelta(userId, debt.currency, delta, manager);
      }

      return persisted;
    });

    if (isRealPayment) {
      const delta = saved.type === DebtLoanType.DEBT ? -dto.settledAmount : dto.settledAmount;
      this.logger.info(
        {
          event: 'debt_loan.settled',
          mode: 'real-payment',
          debtLoanId: saved.id,
          userId,
          type: saved.type,
          currency: saved.currency,
          settledAmount: dto.settledAmount,
          poolDelta: delta,
          remaining: saved.remainingAmount,
        },
        'debt_loan.settled',
      );
    } else {
      this.logger.info(
        {
          event: 'debt_loan.settled',
          mode: 'informal',
          debtLoanId: saved.id,
          userId,
          settledAmount: dto.settledAmount,
          remaining: saved.remainingAmount,
        },
        'debt_loan.settled',
      );
    }

    return saved;
  }
}
